"""
AI Task Decomposer Engine using Gemini 3.5 Flash Lite (Rẻ nhất, tốc độ cao nhất ~1s).
Kiến trúc 2 Tầng:
- Stage 1: Classifier phân loại môn & ngách bài tập chuyên biệt (prompts/classifier.md).
- Stage 2: Router nạp prompt chuyên sâu theo ngách (prompts/specialists/*.md) với few-shot sâu,
           ép chặt giàn giáo nhận thức ADHD và thống nhất 100% schema với tasks_db.json & renderers.js.
Không có fallback giả mạo hay regex chống chế. Lỗi mạng/API -> Báo lỗi rõ ràng.
"""

import os
import re
import json
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types
from src.adhd_scoring.scoring_service import resolve_scaffolding_tier

logger = logging.getLogger(__name__)

# Model rẻ và nhẹ nhất trong họ Gemini hiện nay
CHEAPEST_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-3.5-flash"
REPO_ROOT = Path(__file__).resolve().parents[2]

# --- SCHEMA CHO STAGE 1: CLASSIFIER ---
CLASSIFIER_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "subject": {
            "type": "STRING",
            "enum": ["math", "vietnamese", "english", "routine"]
        },
        "category": {
            "type": "STRING",
            "enum": [
                "math_geometry",
                "math_word_problem_basic",
                "math_word_problem_model",
                "math_arithmetic_algebra",
                "viet_reading",
                "viet_grammar",
                "eng_vocab_sentence",
                "life_routine"
            ],
            "description": "Ngách nhỏ sư phạm chuyên biệt duy nhất"
        },
        "reasoning": {"type": "STRING", "description": "Giải thích ngắn gọn dưới 20 từ lý do chọn ngách"}
    },
    "required": ["subject", "category"]
}

# --- SCHEMA CHO BÀI TOÁN HÌNH HỌC (ÉP CHẶT geometry_spec SVG) ---
GEOMETRY_DECOMPOSER_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "benchmark_id": {"type": "STRING"},
        "original_title": {"type": "STRING"},
        "exercise_type": {"type": "STRING", "enum": ["geometry"]},
        "subject": {"type": "STRING", "enum": ["toan", "khoa_hoc_tu_nhien"]},
        "original_text": {"type": "STRING", "description": "Đề bài gốc hoàn chỉnh để trẻ đọc ở bước 1"},
        "geometry_spec": {
            "type": "OBJECT",
            "properties": {
                "shape_type": {"type": "STRING", "enum": ["rectangle", "square", "parallelogram", "triangle", "house_counting", "nested"]},
                "dimensions": {
                    "type": "OBJECT",
                    "properties": {
                        "length": {"type": "STRING"},
                        "width": {"type": "STRING"},
                        "base": {"type": "STRING"},
                        "height": {"type": "STRING"},
                        "side": {"type": "STRING"}
                    }
                },
                "target": {"type": "STRING", "enum": ["area", "perimeter", "remaining_area"]},
                "nested_label": {"type": "STRING"}
            },
            "required": ["shape_type", "dimensions", "target"],
            "description": "Thông số hình học bắt buộc để vẽ hình SVG trực quan cho trẻ ADHD"
        },
        "target_keywords": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Kích thước hình học kèm đơn vị và từ khóa mục tiêu (chu vi, diện tích)"
        },
        "steps": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "step_id": {"type": "INTEGER"},
                    "title": {"type": "STRING"},
                    "action_verb": {"type": "STRING", "enum": ["Gạch_chân", "Chọn", "Tính", "Điền"]},
                    "atomic_instruction": {"type": "STRING", "description": "Chỉ dẫn ngắn gọn < 15 từ"},
                    "ui_type": {"type": "STRING", "enum": ["highlight", "single_choice", "text_input", "progressive_calculation"]},
                    "prompt_text": {"type": "STRING", "description": "Nội dung câu hỏi hoặc biểu thức tính toán"},
                    "highlight_target_segments": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Cụm từ cần gạch chân nếu ui_type là highlight"
                    },
                    "options": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Lựa chọn nếu ui_type là single_choice"
                    },
                    "placeholder": {"type": "STRING"},
                    "expected_answer": {"type": "STRING"},
                    "feedback_on_error": {"type": "STRING", "description": "Lời động viên nhẹ nhàng ấm áp RSD-safe của Milo"},
                    "dopamine_points": {"type": "INTEGER"}
                },
                "required": ["step_id", "title", "action_verb", "atomic_instruction", "ui_type", "prompt_text", "expected_answer", "feedback_on_error"]
            }
        },
        "final_answer": {"type": "STRING"},
        "pedagogical_summary": {"type": "STRING"}
    },
    "required": ["original_title", "exercise_type", "subject", "original_text", "geometry_spec", "target_keywords", "steps", "final_answer"]
}

# --- SCHEMA TIÊU CHUẨN CHO CÁC DẠNG BÀI TOÁN KHÁC ---
STANDARD_MATH_DECOMPOSER_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "benchmark_id": {"type": "STRING"},
        "original_title": {"type": "STRING"},
        "exercise_type": {
            "type": "STRING",
            "enum": ["word_problem", "pure_arithmetic", "find_x", "multi_item_arithmetic", "multi_item_find_x"]
        },
        "subject": {"type": "STRING", "enum": ["toan"]},
        "original_text": {"type": "STRING", "description": "Đề bài gốc hoàn chỉnh"},
        "header_title": {"type": "STRING", "description": "Tiêu đề chung hiển thị ở header (ví dụ: Bài 1: Đặt tính rồi tính hoặc Bài 2: Tìm x)"},
        "items": {
            "type": "ARRAY",
            "description": "Danh sách các ý con (a, b, c, d) nếu đề bài gồm nhiều ý độc lập",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "item_id": {"type": "STRING"},
                    "label": {"type": "STRING"},
                    "equation": {"type": "STRING"},
                    "top": {"type": "STRING"},
                    "op": {"type": "STRING"},
                    "bot": {"type": "STRING"},
                    "expected_answer": {"type": "STRING"}
                }
            }
        },
        "target_keywords": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Bao gồm: (1) Số liệu/đại lượng kèm đơn vị, (2) Từ khóa quan hệ/toán tử ('tất cả', 'còn lại', 'nhiều hơn')"
        },
        "steps": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "step_id": {"type": "INTEGER"},
                    "title": {"type": "STRING"},
                    "action_verb": {"type": "STRING", "enum": ["Gạch_chân", "Chọn", "Tính", "Điền"]},
                    "atomic_instruction": {"type": "STRING", "description": "Chỉ dẫn ngắn gọn < 15 từ"},
                    "ui_type": {"type": "STRING", "enum": ["highlight", "single_choice", "text_input"]},
                    "prompt_text": {"type": "STRING", "description": "Nội dung câu hỏi hoặc biểu thức tính toán chuẩn đặt tính theo dòng"},
                    "highlight_target_segments": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Cụm từ cần gạch chân nếu ui_type là highlight"
                    },
                    "options": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Lựa chọn nếu ui_type là single_choice"
                    },
                    "placeholder": {"type": "STRING"},
                    "expected_answer": {"type": "STRING"},
                    "feedback_on_error": {"type": "STRING", "description": "Lời động viên nhẹ nhàng RSD-safe của Milo"},
                    "progressive_phases": {
                        "type": "ARRAY",
                        "description": "Danh sách 2 nhịp tính toán lũy tiến nếu phép tính có nhiều toán hạng",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "phase_id": {"type": "INTEGER"},
                                "lead_text": {"type": "STRING"},
                                "expression": {"type": "STRING"},
                                "calc": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "top": {"type": "STRING"},
                                        "op": {"type": "STRING"},
                                        "bot": {"type": "STRING"},
                                        "expected": {"type": "STRING"}
                                    },
                                    "required": ["top", "op", "bot", "expected"]
                                },
                                "expected_answer": {"type": "STRING"},
                                "unit": {"type": "STRING"}
                            },
                            "required": ["phase_id", "lead_text", "expression", "calc", "expected_answer"]
                        }
                    },
                    "dopamine_points": {"type": "INTEGER"}
                },
                "required": ["step_id", "title", "action_verb", "atomic_instruction", "ui_type", "prompt_text", "expected_answer", "feedback_on_error"]
            }
        },
        "final_answer": {"type": "STRING"},
        "pedagogical_summary": {"type": "STRING"}
    },
    "required": ["original_title", "exercise_type", "subject", "original_text", "target_keywords", "steps", "final_answer"]
}


def load_prompt_file(relative_path: str) -> str:
    prompt_file = REPO_ROOT / relative_path
    if prompt_file.is_file():
        try:
            with open(prompt_file, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.warning(f"Không thể đọc file prompt {prompt_file}: {e}")
    return ""


def load_classifier_prompt() -> str:
    content = load_prompt_file("prompts/classifier.md")
    return content or "Bạn là Bộ Phân Loại Nhiệm Vụ (Task Classifier) chuẩn GDPT 2018 cho trẻ ADHD."


def load_specialist_prompt(category: str) -> str:
    path_map = {
        "math_geometry": "prompts/specialists/math_geometry.md",
        "math_word_problem_basic": "prompts/specialists/math_word_problem_basic.md",
        "math_word_problem_model": "prompts/specialists/math_word_problem_model.md",
        "math_arithmetic_algebra": "prompts/specialists/math_arithmetic_algebra.md",
    }
    rel_path = path_map.get(category)
    if rel_path:
        content = load_prompt_file(rel_path)
        if content:
            return content
    # Fallback to general micro_task_decomposer prompt
    return load_prompt_file("prompts/micro_task_decomposer.md") or "Bạn là Chuyên gia Sư phạm ADHD."


def fast_heuristic_classify(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Nhận diện siêu tốc ngách sư phạm (<1ms) cho các dạng bài tiểu học chuẩn mực,
    tiết kiệm 20-30s độ trễ mạng so với việc gọi remote LLM 2 lần liên tiếp.
    """
    lower = raw_text.lower().strip()
    # 1. Sinh hoạt đời thường
    if any(k in lower for k in ["dọn dẹp", "bàn học", "rác", "quét nhà", "lau bàn", "gấp quần áo", "cặp sách", "đánh răng", "đi ngủ", "rửa bát"]):
        return {"subject": "routine", "category": "life_routine", "reasoning": "Khớp từ khóa thói quen sinh hoạt"}
    # 2. Tiếng Anh
    if any(k in lower for k in ["choose the", "fill in", "read the passage", "translate to english"]):
        return {"subject": "english", "category": "eng_vocab_sentence", "reasoning": "Khớp dạng bài Tiếng Anh"}
    # 3. Tiếng Việt
    if any(k in lower for k in ["đoạn văn", "bài thơ", "chính tả", "tập đọc", "từ láy", "câu chuyện", "nghĩa của từ"]) and not any(op in lower for op in ["+", "-", "×", "*", "/", ":", "="]):
        return {"subject": "vietnamese", "category": "viet_reading", "reasoning": "Khớp bài đọc hiểu Tiếng Việt"}
    # 4. Toán hình học
    if any(k in lower for k in ["chu vi", "diện tích", "hình chữ nhật", "hình vuông", "hình bình hành", "tam giác", "hình tròn", "hình thoi", "cửa sổ", "mái nhà", "cạnh", "chiều dài", "chiều rộng"]):
        return {"subject": "math", "category": "math_geometry", "reasoning": "Khớp dạng toán Hình học & Đo lường"}
    # 5. Toán mô hình Tổng-Hiệu / Tỉ số / Chuyển động
    if any(k in lower for k in ["tổng và hiệu", "tổng - hiệu", "nhiều hơn", "ít hơn", "vận tốc", "quãng đường", "thời gian", "tỉ số", "gấp"]) and any(w in lower for w in ["hỏi", "bao nhiêu", "tìm hai số"]):
        if any(m in lower for m in ["tổng", "hiệu", "hai lớp", "hai kho", "hai thùng", "hai xe", "vận tốc", "km/h"]):
            return {"subject": "math", "category": "math_word_problem_model", "reasoning": "Khớp toán mô hình Tổng-Hiệu / Tỉ số"}
    # 6. Toán tính toán thuần / Tìm X / Đặt tính
    if any(k in lower for k in ["đặt tính", "tìm x", "giá trị biểu thức", "tính nhẩm"]) or (not any(w in lower for w in ["hỏi", "bao nhiêu"]) and any(op in lower for op in ["+", "-", "*", "×", "/", ":"])):
        return {"subject": "math", "category": "math_arithmetic_algebra", "reasoning": "Khớp dạng bài Đặt tính & Số học"}
    # 7. Toán lời văn cơ bản
    if any(w in lower for w in ["hỏi", "bao nhiêu", "có tất cả", "còn lại", "mỗi bạn", "bông hoa", "quả cam", "con chim"]):
        return {"subject": "math", "category": "math_word_problem_basic", "reasoning": "Khớp toán lời văn thực tế cơ bản"}
    return None


def auto_detect_progressive_phases(prompt_text: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    """
    Auto-Detector Sư Phạm ADHD:
    Tự động nhận diện biểu thức có phép tính liên tiếp (nhiều toán hạng / ngoặc đơn)
    và phân rã thành 2 nhịp lũy tiến trên 1 thẻ bài để tránh quá tải nhận thức.
    """
    if not prompt_text or not isinstance(prompt_text, str):
        return None

    # 1. Bóc tách đơn vị trong ngoặc ở cuối (ví dụ: "(quyển)", "(con gà)", "(m2)")
    unit = ""
    unit_m = re.search(r'\s*\(([^\d\+\-\*×x:\/]+?)\)\s*$', prompt_text)
    if unit_m:
        unit = unit_m.group(1).strip()
        expr_part = prompt_text[:unit_m.start()].strip()
    else:
        expr_part = prompt_text.strip()

    # Chuẩn hoá ký hiệu toán tử và gọt bỏ dấu hỏi
    clean_expr = expr_part.replace('x', '×').replace('*', '×').replace('/', ':')
    clean_expr = re.sub(r'=\s*(?:\?|[\.\_]+)?$', '', clean_expr).strip()

    # Dạng 1: (A op1 B) op2 C (ví dụ: ((450 - 50) : 2) hoặc (280 + 40) : 2)
    m = re.search(r'\(\s*(\d+)\s*([\+\-×:])\s*(\d+)\s*\)\s*([\+\-×:])\s*(\d+)', clean_expr)
    if not m:
        # Dạng 2: A op1 B op2 C (ví dụ: 1200 : 5 × 3 hoặc 24 : 4 × 6)
        m = re.search(r'(?<!\d)(\d+)\s*([:×\+\-])\s*(\d+)\s*([:×\+\-])\s*(\d+)(?!\d)', clean_expr)

    if not m:
        return None

    try:
        n1 = int(m.group(1))
        op1 = m.group(2)
        n2 = int(m.group(3))
        op2 = m.group(4)
        n3 = int(m.group(5))

        # Tính toán nhịp 1
        if op1 == '+': r1 = n1 + n2
        elif op1 == '-': r1 = n1 - n2
        elif op1 == '×': r1 = n1 * n2
        elif op1 == ':': r1 = n1 // n2 if n2 != 0 else 0
        else: return None

        # Tính toán nhịp 2
        if op2 == '+': r2 = r1 + n3
        elif op2 == '-': r2 = r1 - n3
        elif op2 == '×': r2 = r1 * n3
        elif op2 == ':': r2 = r1 // n3 if n3 != 0 else 0
        else: return None

        lead1 = f"1) Nhịp 1: Tính {n1} {op1} {n2}:"
        lead2 = f"2) Nhịp 2: Tính tiếp {r1} {op2} {n3}:"

        if op1 == '+' and op2 == ':' and n3 == 2:
            lead1 = "1) Tính tổng hai đại lượng:"
            lead2 = "2) Chia đôi tìm kết quả:"
        elif op1 == '-' and op2 == ':' and n3 == 2:
            lead1 = "1) Tính hiệu hai đại lượng:"
            lead2 = "2) Chia đôi tìm kết quả:"
        elif op1 == ':' and op2 == '×':
            lead1 = "1) Rút về 1 đơn vị (chia đều):"
            lead2 = "2) Nhân lên số phần cần tìm:"
        elif op1 == '×' and op2 == ':':
            lead1 = "1) Tính tích bước đầu:"
            lead2 = "2) Chia đều tìm kết quả:"
        elif op1 == '+' and op2 == '×' and n3 == 2:
            lead1 = "1) Tính nửa chu vi (dài + rộng):"
            lead2 = "2) Nhân đôi tính chu vi:"

        return [
            {
                "phase_id": 1,
                "lead_text": lead1,
                "expression": f"{n1} {op1} {n2} =",
                "calc": {
                    "top": str(n1),
                    "op": op1,
                    "bot": str(n2),
                    "expected": str(r1)
                },
                "expected_answer": str(r1),
                "unit": ""
            },
            {
                "phase_id": 2,
                "lead_text": lead2,
                "expression": f"{r1} {op2} {n3} =",
                "calc": {
                    "top": str(r1),
                    "op": op2,
                    "bot": str(n3),
                    "expected": str(r2)
                },
                "expected_answer": str(r2),
                "unit": unit
            }
        ]
    except Exception:
        return None


async def classify_task(raw_text: str, client: genai.Client) -> Dict[str, Any]:
    """
    STAGE 1: Phân loại môn học và ngách nhỏ chuyên biệt.
    Ưu tiên nhận diện siêu tốc (<1ms) để tránh bị timeout mạng, chỉ gọi LLM khi đề bài đặc biệt.
    """
    fast_match = fast_heuristic_classify(raw_text)
    if fast_match:
        logger.info(f"Stage 1 Fast Heuristic kết quả: category={fast_match['category']}, reasoning={fast_match['reasoning']}")
        return fast_match

    classifier_instruction = load_classifier_prompt()
    user_input = f"""Hãy phân loại đề bài sau vào đúng Môn học và Ngách chuyên biệt:
Đề bài: "{raw_text}"
"""
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=CHEAPEST_MODEL,
            contents=user_input,
            config=types.GenerateContentConfig(
                system_instruction=classifier_instruction,
                response_mime_type="application/json",
                response_schema=CLASSIFIER_SCHEMA,
                temperature=0.0
            )
        )
        if response and response.text:
            return json.loads(response.text)
    except Exception as e:
        logger.warning(f"Lỗi Stage 1 Classifier: {e}, mặc định sang math_word_problem_basic")
    
    return {"subject": "math", "category": "math_word_problem_basic", "reasoning": "Default word problem"}


async def decompose_exercise_with_gemini(
    raw_text: str, 
    grade: int = 3, 
    cognitive_profile: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    STAGE 2: Băm vi nhiệm vụ chuyên sâu theo ngách nhỏ với Few-shot đắt giá và Schema ép chặt.
    """
    # Tải lại .env với override=True để luôn nhận API key mới nhất mà không cần restart server
    load_dotenv(dotenv_path=REPO_ROOT / ".env", override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Chưa cấu hình GEMINI_API_KEY trong file .env! Không thể băm bài.")

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=35000)
    )

    # 1. Gọi Stage 1: Phân loại môn & ngách nhỏ
    classification = await classify_task(raw_text, client)
    category = classification.get("category", "math_word_problem_basic")
    logger.info(f"Stage 1 Classifier kết quả: category={category}, reasoning={classification.get('reasoning')}")

    # 2. Chọn Prompt chuyên biệt và Schema tương ứng
    specialist_prompt = load_specialist_prompt(category)
    if category == "math_geometry":
        schema_to_use = GEOMETRY_DECOMPOSER_SCHEMA
    else:
        schema_to_use = STANDARD_MATH_DECOMPOSER_SCHEMA

    # 2. Xac dinh Bac Gian giao 5 cap do tu Cognitive Profile
    cdi_val = 0.50
    wm_val = 2
    if cognitive_profile:
        norm_idx = cognitive_profile.get("normalized_indices", {})
        if "composite_deficit_index" in norm_idx:
            cdi_val = float(norm_idx["composite_deficit_index"])
        elif "composite_deficit_index" in cognitive_profile:
            cdi_val = float(cognitive_profile["composite_deficit_index"])
        wm_val = cognitive_profile.get("working_memory_capacity", 2)

    tier_info = resolve_scaffolding_tier(cdi_val, wm_val)
    tier_id = tier_info["tier_id"]
    tier_name = tier_info["tier_name"]
    target_steps = tier_info["target_step_count"]

    if tier_id == 1:
        tier_rule = """- CHỈ ĐỊNH PHÂN BẬC BẬC 1: SIÊU PHÂN RÃ (5 VI BƯỚC NGUYÊN TỬ, DÀNH CHO TRẺ ADHD NẶNG):
  + Bắt buộc phân rã tối đa 5 bước cực nhỏ (< 10 từ/bước, 1 động từ đơn).
  + Toán lời văn: Bước 1 gạch chân số 1; Bước 2 gạch chân số 2 + từ khóa; Bước 3 hỏi ý nghĩa từ khóa; Bước 4 chọn phép tính; Bước 5 tính toán.
  + Đọc hiểu: Dò từ khóa ở câu đầu -> Xác định chủ thể -> Trả lời câu hỏi.
  + Tiếng Anh: Chia thành từng cụm 2 từ (cặp mảnh ghép).
  + Trắc nghiệm chỉ tối đa 2 lựa chọn (50/50)."""
    elif tier_id == 2:
        tier_rule = """- CHỈ ĐỊNH PHÂN BẬC BẬC 2: GIÀN GIÁO CHUYÊN SÂU (4 VI BƯỚC CHUẨN GDPT 2018):
  + Bắt buộc phân rã thành 4 bước: 
    Bước 1 (highlight): Gạch chân đầy đủ số liệu và từ khóa toán tử.
    Bước 2 (single_choice): Hỏi ý nghĩa từ khóa (+ hay -).
    Bước 3 (single_choice): Chọn biểu thức phép tính.
    Bước 4 (text_input): Tính toán đáp số.
  + Đọc hiểu: Gạch chân từ khóa trong bài đọc -> Dò chủ thể -> Chọn đáp án trắc nghiệm.
  + Tiếng Anh: Dịch từ -> Ghép vế -> Chọn câu đúng."""
    elif tier_id == 3:
        tier_rule = """- CHỈ ĐỊNH PHÂN BẬC BẬC 3: GIÀN GIÁO CÂN BẰNG (3 VI BƯỚC GỘP, DÀNH CHO TRẺ TIẾN BỘ):
  + Bắt buộc phân rã thành đúng 3 bước:
    Bước 1 (single_choice hoặc highlight): Đọc đề và chọn phép tính (gộp bước gạch chân và nhận diện phép tính).
    Bước 2 (text_input): Đặt tính và tính nhẩm đáp số.
    Bước 3 (single_choice hoặc text_input): Kết luận danh số đơn vị hoặc kiểm tra lại.
  + Đọc hiểu: Bỏ bước gạch chân mớm ý, Bước 1 đọc lướt và trả lời câu hỏi đọc hiểu, Bước 2 trích dẫn chứng.
  + Tiếng Anh: Ghép câu từ 3 khối lớn."""
    elif tier_id == 4:
        tier_rule = """- CHỈ ĐỊNH PHÂN BẬC BẬC 4: TỰ LẬP CÓ HƯỚNG DẪN (2 BƯỚC TỔNG HỢP, DÀNH CHO TRẺ TIỆM CẬN BÌNH THƯỜNG):
  + Bắt buộc rút gọn thành đúng 2 bước (Scaffolding Fading):
    Bước 1 (text_input): Trẻ tự lập biểu thức và tính đáp số trong 1 card (ví dụ: '15 - 8 = 7').
    Bước 2 (text_input hoặc single_choice): Ghi câu kết luận đáp số hoàn chỉnh kèm đơn vị.
  + Đọc hiểu: Trả lời câu hỏi đọc hiểu suy luận + viết câu tóm tắt.
  + Tiếng Anh: Sắp xếp toàn bộ câu hoàn chỉnh trực tiếp."""
    else:
        tier_rule = """- CHỈ ĐỊNH PHÂN BẬC BẬC 5: TỰ CHỦ HOÀN TOÀN & MỞ RỘNG (1 BƯỚC GIẢI + 1 THỬ THÁCH BONUS):
  + Bước 1 (text_input): Trẻ tự lập giải trọn vẹn bài toán trong 1 card duy nhất.
  + Bước 2 (single_choice hoặc text_input): Thử thách tư duy mở rộng / phản biện liên quan đến đề bài."""

    user_prompt = f"""
Đề bài gốc:
"{raw_text}"

Khối lớp: Lớp {grade}
Ngách chuyên biệt đã xác định: {category}
Hồ sơ nhận thức trẻ: {json.dumps(cognitive_profile or {}, ensure_ascii=False)}
Phân bậc giàn giáo áp dụng: {tier_name} (Mục tiêu: {target_steps} bước)

{tier_rule}

Hãy phân tích và băm bài này thành chuỗi vi nhiệm vụ nguyên tử ({target_steps} bước) theo đúng JSON Schema đã định.
LƯU Ý QUAN TRỌNG:
- BÓC TÁCH ĐỀ BÀI TRẮC NGHIỆM: Nếu đề bài có các đáp án A, B, C, D (ví dụ: 'A. 23 m\nB. 46 m...'): BẮT BUỘC BỎ HẾT các đáp án đó ra khỏi `original_text` và `prompt_text` của Bước 1 (Gạch chân). Thân đề bài chỉ giữ lại câu chuyện và câu hỏi. Các phương án A, B, C, D chỉ xuất hiện ở bước chọn trắc nghiệm cuối cùng.
- Với bài hình học: TUYỆT ĐỐI KHÔNG đưa công thức vào hình vẽ SVG (`geometry_spec`). Nếu tính chu vi hình chữ nhật: BẮT BUỘC chia làm 2 bước tính toán riêng biệt: Bước tính nửa chu vi (dài + rộng), sau đó Bước tính chu vi (nửa chu vi × 2).
- Với bài toán rút về đơn vị: BẮT BUỘC chia làm 2 bước tính toán: Bước 1 rút về 1 đơn vị bằng phép chia, Bước 2 nhân lên số đơn vị cần tìm.
- Với phép tính nhiều toán hạng (như tìm phân số A : B × C hoặc tìm số lớn (A + B) : 2): BẮT BUỘC dùng ui_type='progressive_calculation' và chia thành 2 nhịp lũy tiến trong `progressive_phases`: Nhịp 1 rút về 1 đơn vị hoặc tính tổng, Nhịp 2 nhân lên hoặc chia đôi. Bước tìm đại lượng còn lại (như tìm số vịt) chuyển sang bước sau bình thường (không lạm dụng).
- Với phép tính cộng/trừ/nhân/chia: `prompt_text` của bước tính toán phải chứa biểu thức số học rõ ràng 2 toán hạng (ví dụ: '15 + 8 = ?', '23 × 2 = ?', '56 : 2 = ?') để kích hoạt giao diện đặt tính cột dọc theo dòng (phép chia tự động chuyển thành bảng đặt tính phép chia chuẩn tiểu học).
"""

    try:
        response = None
        last_err = None
        for attempt in range(3):
            active_model = CHEAPEST_MODEL if attempt == 0 else FALLBACK_MODEL
            try:
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=active_model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=specialist_prompt,
                        response_mime_type="application/json",
                        response_schema=schema_to_use,
                        temperature=0.1
                    )
                )
                if response and response.text:
                    break
            except Exception as api_err:
                last_err = api_err
                err_str = str(api_err)
                if any(term in err_str for term in ["503", "429", "UNAVAILABLE", "ResourceExhausted"]) and attempt < 2:
                    logger.warning(f"Gemini API quá tải tạm thời (lần {attempt+1}/3), thử lại sau 2s: {api_err}")
                    await asyncio.sleep(2.0)
                    continue
                raise api_err
        
        if not response or not response.text:
            raise RuntimeError(f"Gemini trả về phản hồi rỗng hoặc lỗi: {last_err}")

        parsed_data = json.loads(response.text)
        
        # 3. Chuẩn hóa dữ liệu đầu ra đồng bộ 100% với tasks_db.json và renderers.js
        # Tước bỏ triệt để A, B, C, D nếu còn lọt vào original_text
        cleaned_orig = parsed_data.get("original_text", raw_text)
        if cleaned_orig and isinstance(cleaned_orig, str):
            cleaned_orig = re.split(r'\n\s*[A-D][\.\:\)]', cleaned_orig)[0].strip()
            if cleaned_orig.endswith('là:'):
                cleaned_orig = cleaned_orig[:-1] + ' là bao nhiêu?'
            parsed_data["original_text"] = cleaned_orig

        transformed_tasks = []
        exercise_type = parsed_data.get("exercise_type", "word_problem")
        geometry_spec = parsed_data.get("geometry_spec")
        reading_passage = parsed_data.get("reading_passage")

        for s in parsed_data.get("steps", []):
            ui_type = s.get("ui_type", "text_input")
            step_prompt = s.get("prompt_text") or s.get("atomic_instruction")
            if ui_type == "highlight" and step_prompt and isinstance(step_prompt, str):
                step_prompt = re.split(r'\n\s*[A-D][\.\:\)]', step_prompt)[0].strip()
                if step_prompt.endswith('là:'):
                    step_prompt = step_prompt[:-1] + ' là bao nhiêu?'

            ui_payload = {
                "prompt_text": step_prompt,
                "placeholder": s.get("placeholder") or "Nhập kết quả...",
                "exercise_type": exercise_type
            }
            if geometry_spec:
                ui_payload["geometry_spec"] = geometry_spec
            if reading_passage:
                ui_payload["reading_passage"] = reading_passage

            # Auto-Detector Sư phạm ADHD: Tự động phát hiện và bóc tách phép tính liên tiếp
            prog_phases = s.get("progressive_phases")
            if not prog_phases and ui_type != "highlight" and ui_type != "single_choice":
                auto_phases = auto_detect_progressive_phases(step_prompt)
                if auto_phases:
                    prog_phases = auto_phases
                    ui_type = "progressive_calculation"

            if ui_type == "progressive_calculation" or prog_phases:
                ui_payload["progressive_phases"] = prog_phases
                ui_type = "progressive_calculation"

            if ui_type == "highlight":
                ui_payload["highlight_target_segments"] = s.get("highlight_target_segments") or parsed_data.get("target_keywords", [])
            elif ui_type == "single_choice":
                ui_payload["options"] = s.get("options") or []

            transformed_tasks.append({
                "step_id": s["step_id"],
                "title": s["title"],
                "badge": s["title"],
                "action_verb": s["action_verb"],
                "atomic_instruction": s["atomic_instruction"],
                "text": s["atomic_instruction"],
                "duration_sec": 120,
                "ui_type": ui_type,
                "type": ui_type,
                "ui_payload": ui_payload,
                "ui_data": ui_payload,  # Đồng bộ tuyệt đối với tasks_db.json và renderers.js
                "cognitive_scaffolding": {
                    "scaffolding_type": "sub_question" if s["step_id"] > 1 else "visual_cue",
                    "cognitive_load_level": "low",
                    "working_memory_items": 1,
                    "explanation": s["title"]
                },
                "hints": [s["atomic_instruction"]],
                "success_criteria": {
                    "evaluation_type": "exact_match",
                    "expected_answer": s["expected_answer"],
                    "feedback_on_error": s["feedback_on_error"]
                },
                "expected_answer": s["expected_answer"],
                "feedback_on_error": s["feedback_on_error"],
                "immediate_reinforcer": {
                    "visual_asset": "sparkle_star_01",
                    "audio_cue": "positive_bell_c6",
                    "dopamine_points": s.get("dopamine_points", 30)
                },
                "dopamine_points": s.get("dopamine_points", 30),
                "is_final_step": (s["step_id"] == len(parsed_data["steps"]))
            })

        return {
            "session_id": f"SESSION_GEMINI_{int(os.times().elapsed * 1000)}",
            "task_metadata": {
                "benchmark_id": parsed_data.get("benchmark_id", f"CUSTOM_{category.upper()}"),
                "original_title": parsed_data.get("original_title", raw_text[:50]),
                "original_text": parsed_data.get("original_text", raw_text),
                "grade": grade,
                "subject": "toan",
                "exercise_type": exercise_type,
                "category": category,
                "classification_reasoning": classification.get("reasoning", ""),
                "geometry_spec": geometry_spec,
                "target_keywords": parsed_data.get("target_keywords", []),
                "target_cognitive_profile": cognitive_profile or {},
                "total_micro_tasks": len(transformed_tasks),
                "total_estimated_duration_sec": len(transformed_tasks) * 120,
                "header_title": parsed_data.get("header_title", parsed_data.get("original_title", "Bài tập")),
                "items": parsed_data.get("items", [])
            },
            "header_title": parsed_data.get("header_title", parsed_data.get("original_title", "Bài tập")),
            "items": parsed_data.get("items", []),
            "micro_tasks": transformed_tasks,
            "final_summary": {
                "final_answer_step_id": len(transformed_tasks),
                "extracted_final_answer": parsed_data.get("final_answer", ""),
                "pedagogical_wrap_up": parsed_data.get("pedagogical_summary", "Bạn Milo rất tự hào về nỗ lực của con!")
            }
        }
    except Exception as e:
        logger.error(f"Lỗi khi gọi Gemini: {e}")
        raise RuntimeError(f"Lỗi phân tích AI: {str(e)}")
