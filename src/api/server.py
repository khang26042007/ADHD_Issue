"""
FastAPI Backend Service for GDPT 2018 ADHD Micro-Task Scaffolding System.
Provides REST and WebSocket endpoints for Parent and Kid applications.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Setup sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

load_dotenv(dotenv_path=REPO_ROOT / ".env")

import src.api.db as db
from google import genai
from src.api.routine_models import (
    DailyRoutineModel,
    RoutinesListResponse,
    RoutineProofSubmitRequest,
    RoutineHeartCheerRequest,
)
def map_subject_code(subject: str) -> str:
    s = subject.lower().strip()
    if "toán" in s or "toan" in s or "math" in s:
        return "toan"
    if "việt" in s or "viet" in s:
        return "tieng_viet"
    if "anh" in s or "eng" in s:
        return "tieng_anh"
    if "khoa" in s or "khoa_hoc" in s or "tự nhiên" in s or "tu_nhien" in s:
        return "khoa_hoc_tu_nhien"
    if "hoạt động" in s or "hoat_dong" in s or "sinh hoạt" in s or "chore" in s:
        return "hoat_dong_trai_nghiem"
    return s

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("api_server")

# ==========================================
# FastAPI App Initialization
# ==========================================
app = FastAPI(
    title="ADHD Micro-Task Scaffolding & Sync Backend",
    description="Dual-device Parent/Kid ecosystem with AI Micro-Task decomposition and real-time WebSocket sync.",
    version="1.0.0",
)
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global clients & cache
CURRICULUM_DATA: Dict[str, Any] = {}
TASKS_DB_MAP: Dict[str, Any] = {}
ROUTINES_DB_MAP: Dict[str, Any] = {}
PRE_DECOMPOSED_ROUTINES: List[Dict[str, Any]] = []
ROOM_STATES: Dict[str, Dict[str, Any]] = {}
APP_START_TIME = time.time()



# ==========================================
# Pre-decomposed Daily Life Routines (Bài sinh hoạt băm sẵn)
# ==========================================
def initialize_pre_decomposed_routines() -> List[Dict[str, Any]]:
    return [
        {
            "id": "ROUTINE_01_CLEAN_DESK",
            "grade": 2,
            "subject": "khoa_hoc_tu_nhien",
            "category": "Kỹ năng sinh hoạt đời thường",
            "topic": "Dọn dẹp góc học tập ngăn nắp",
            "difficulty": "Cơ bản",
            "estimated_duration_min": 6,
            "original_text": "Sau khi học bài xong, em hãy tự giác dọn dẹp góc học tập cho ngăn nắp: cất sách vở vào đúng ngăn bàn, gom bút thước vào hộp bút, lau sạch bụi trên mặt bàn và tắt đèn học.",
            "session_id": "SESSION_ROUTINE_01_CLEAN_DESK",
            "task_metadata": {
                "benchmark_id": "ROUTINE_01_CLEAN_DESK",
                "original_title": "Dọn dẹp góc học tập ngăn nắp",
                "grade": 2,
                "subject": "khoa_hoc_tu_nhien",
                "target_cognitive_profile": {
                    "attention_span_minutes": 10,
                    "recommended_micro_task_duration_sec": 120,
                    "working_memory_capacity": 2,
                    "rsd_sensitivity_level": "HIGH",
                    "scaffolding_level": "MODERATE",
                },
                "total_micro_tasks": 4,
                "total_estimated_duration_sec": 480,
            },
            "micro_tasks": [
                {
                    "step_id": 1,
                    "title": "Cất sách vở vào ngăn bàn",
                    "action_verb": "Chọn",
                    "atomic_instruction": "Chọn đúng hành động cất sách vở vào ngăn bàn.",
                    "duration_sec": 120,
                    "ui_type": "single_choice",
                    "ui_payload": {
                        "prompt_text": "Khi học xong, chúng mình nên để sách vở ở đâu?",
                        "options": ["Xếp gọn vào ngăn bàn học", "Để bừa trên giường", "Bỏ dưới đất"],
                    },
                    "cognitive_scaffolding": {
                        "scaffolding_type": "visual_cue",
                        "cognitive_load_level": "low",
                        "working_memory_items": 1,
                        "explanation": "Tách riêng việc cất tài liệu giấy trước để tạo không gian thoáng.",
                    },
                    "hints": ["Con nhìn ngăn bàn học nhé, đó là nơi để sách vở an toàn nhất."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": "Xếp gọn vào ngăn bàn học",
                        "feedback_on_error": "Milo thấy con rất cố gắng! Con thử chọn lại vị trí cất sách vở nha.",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "sparkle_star_01",
                        "audio_cue": "positive_bell_c6",
                        "dopamine_points": 25,
                    },
                    "is_final_step": False,
                },
                {
                    "step_id": 2,
                    "title": "Gom bút thước vào hộp bút",
                    "action_verb": "Chọn",
                    "atomic_instruction": "Chọn đúng hành động thu gom bút và thước kẻ.",
                    "duration_sec": 120,
                    "ui_type": "single_choice",
                    "ui_payload": {
                        "prompt_text": "Bút và thước kẻ nên cất vào đâu để không bị rơi mất?",
                        "options": ["Cho vào hộp bút gọn gàng", "Vứt lung tung trên bàn"],
                    },
                    "cognitive_scaffolding": {
                        "scaffolding_type": "visual_cue",
                        "cognitive_load_level": "low",
                        "working_memory_items": 1,
                        "explanation": "Giúp trẻ hình thành phản xạ gom vật dụng nhỏ tránh thất lạc.",
                    },
                    "hints": ["Hộp bút là ngôi nhà ấm áp của các bạn bút thước đấy con."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": "Cho vào hộp bút gọn gàng",
                        "feedback_on_error": "Milo tin con làm được! Cùng Milo cất bút vào hộp nhé.",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "particle_burst_gold",
                        "audio_cue": "sparkle_ting_short",
                        "dopamine_points": 25,
                    },
                    "is_final_step": False,
                },
                {
                    "step_id": 3,
                    "title": "Lau sạch mặt bàn học",
                    "action_verb": "Chọn",
                    "atomic_instruction": "Chọn hành động làm sạch mặt bàn.",
                    "duration_sec": 120,
                    "ui_type": "single_choice",
                    "ui_payload": {
                        "prompt_text": "Làm thế nào để mặt bàn học sạch bóng bụi bẩn?",
                        "options": ["Lấy khăn lau sạch mặt bàn", "Không cần lau dọn gì cả"],
                    },
                    "cognitive_scaffolding": {
                        "scaffolding_type": "sub_question",
                        "cognitive_load_level": "low",
                        "working_memory_items": 1,
                        "explanation": "Rèn thói quen giữ gìn vệ sinh không gian cá nhân.",
                    },
                    "hints": ["Dùng một chiếc khăn mềm lau sạch mặt bàn con nha."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": "Lấy khăn lau sạch mặt bàn",
                        "feedback_on_error": "Milo luôn ở đây! Dùng khăn lau bụi để bàn học sáng bóng nhé.",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "milo_thumbs_up",
                        "audio_cue": "gentle_pop_success",
                        "dopamine_points": 25,
                    },
                    "is_final_step": False,
                },
                {
                    "step_id": 4,
                    "title": "Tắt đèn bàn học và xếp ghế",
                    "action_verb": "Chọn",
                    "atomic_instruction": "Chọn hành động kết thúc an toàn và ngăn nắp.",
                    "duration_sec": 120,
                    "ui_type": "single_choice",
                    "ui_payload": {
                        "prompt_text": "Bước cuối cùng khi rời góc học tập là gì?",
                        "options": ["Tắt đèn học và đẩy ghế sát bàn", "Để nguyên đèn sáng cả đêm"],
                    },
                    "cognitive_scaffolding": {
                        "scaffolding_type": "verification_check",
                        "cognitive_load_level": "low",
                        "working_memory_items": 1,
                        "explanation": "Chốt chặn hoàn thành chuỗi hành vi và tiết kiệm điện.",
                    },
                    "hints": ["Nhớ tắt công tắc đèn và kéo ghế vào sát bàn học nhé."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": "Tắt đèn học và đẩy ghế sát bàn",
                        "feedback_on_error": "Milo luôn đồng hành cùng con! Nhớ tắt đèn để bảo vệ mắt và tiết kiệm điện nha.",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "confetti_cannon",
                        "audio_cue": "harp_glissando_soft",
                        "dopamine_points": 50,
                    },
                    "is_final_step": True,
                },
            ],
            "final_summary": {
                "final_answer_step_id": 4,
                "extracted_final_answer": "Bàn học gọn gàng và ngăn nắp",
                "pedagogical_wrap_up": "Tuyệt vời! Con đã tự tay hoàn thành xuất sắc việc dọn dẹp góc học tập. Milo rất tự hào về tính tự lập của con!",
            },
        },
        {
            "id": "ROUTINE_02_PACK_BAG",
            "grade": 1,
            "subject": "khoa_hoc_tu_nhien",
            "category": "Kỹ năng sinh hoạt đời thường",
            "topic": "Soạn cặp sách theo thời khóa biểu ngày mai",
            "difficulty": "Cơ bản",
            "estimated_duration_min": 5,
            "original_text": "Trước khi đi ngủ, em hãy chuẩn bị cặp sách cho ngày mai: xem thời khóa biểu, xếp sách giáo khoa và vở bài tập theo đúng môn học, kiểm tra hộp bút có đủ 2 bút mực và 1 thước kẻ.",
            "session_id": "SESSION_ROUTINE_02_PACK_BAG",
            "task_metadata": {
                "benchmark_id": "ROUTINE_02_PACK_BAG",
                "original_title": "Soạn cặp sách theo thời khóa biểu",
                "grade": 1,
                "subject": "khoa_hoc_tu_nhien",
                "target_cognitive_profile": {
                    "attention_span_minutes": 8,
                    "recommended_micro_task_duration_sec": 100,
                    "working_memory_capacity": 2,
                    "rsd_sensitivity_level": "HIGH",
                    "scaffolding_level": "MODERATE",
                },
                "total_micro_tasks": 3,
                "total_estimated_duration_sec": 300,
            },
            "micro_tasks": [
                {
                    "step_id": 1,
                    "title": "Xem thời khóa biểu ngày mai",
                    "action_verb": "Đọc",
                    "atomic_instruction": "Đọc thời khóa biểu xem ngày mai có những môn học nào.",
                    "duration_sec": 100,
                    "ui_type": "checkbox",
                    "ui_payload": {"prompt_text": "Con đã nhìn vào thời khóa biểu ngày mai chưa?"},
                    "cognitive_scaffolding": {
                        "scaffolding_type": "visual_cue",
                        "cognitive_load_level": "low",
                        "working_memory_items": 1,
                        "explanation": "Kích hoạt định hướng chú ý trước khi thao tác xếp sách.",
                    },
                    "hints": ["Nhìn vào cột thứ ngày mai trên bảng thời khóa biểu nhé."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": True,
                        "feedback_on_error": "Milo ở đây cùng con, con lấy thời khóa biểu ra xem nào!",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "sparkle_star_01",
                        "audio_cue": "positive_bell_c6",
                        "dopamine_points": 25,
                    },
                    "is_final_step": False,
                },
                {
                    "step_id": 2,
                    "title": "Xếp sách vở vào cặp",
                    "action_verb": "Kéo",
                    "atomic_instruction": "Xếp sách và vở đúng môn vào trong cặp.",
                    "duration_sec": 100,
                    "ui_type": "single_choice",
                    "ui_payload": {
                        "prompt_text": "Xếp sách vở các môn ngày mai vào cặp sách:",
                        "options": ["Đã xếp đúng đủ các môn", "Chưa xếp"],
                    },
                    "cognitive_scaffolding": {
                        "scaffolding_type": "fill_in_the_blank",
                        "cognitive_load_level": "low",
                        "working_memory_items": 2,
                        "explanation": "Giảm tải bộ nhớ làm việc bằng thao tác đối chiếu từng môn.",
                    },
                    "hints": ["Mỗi môn con lấy 1 cuốn sách giáo khoa và 1 cuốn vở nhé."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": "Đã xếp đúng đủ các môn",
                        "feedback_on_error": "Không sao cả, con kiểm tra lại từng môn với Milo nhé.",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "particle_burst_gold",
                        "audio_cue": "sparkle_ting_short",
                        "dopamine_points": 30,
                    },
                    "is_final_step": False,
                },
                {
                    "step_id": 3,
                    "title": "Kiểm tra hộp bút và kéo khóa",
                    "action_verb": "Chọn",
                    "atomic_instruction": "Kiểm tra hộp bút và kéo khóa cặp sách cẩn thận.",
                    "duration_sec": 100,
                    "ui_type": "single_choice",
                    "ui_payload": {
                        "prompt_text": "Hộp bút đã có đủ bút, thước và khóa cặp đã kéo kín chưa?",
                        "options": ["Đầy đủ và khóa cặp đã kéo kín", "Quên chưa kéo khóa"],
                    },
                    "cognitive_scaffolding": {
                        "scaffolding_type": "verification_check",
                        "cognitive_load_level": "low",
                        "working_memory_items": 1,
                        "explanation": "Chốt chặn chống quên đồ dùng học tập.",
                    },
                    "hints": ["Mở hộp bút xem có 2 bút và 1 thước kẻ chưa con nha."],
                    "success_criteria": {
                        "evaluation_type": "exact_match",
                        "expected_answer": "Đầy đủ và khóa cặp đã kéo kín",
                        "feedback_on_error": "Milo nhìn thấy con đã rất cẩn thận! Kiểm tra lại hộp bút nha.",
                    },
                    "immediate_reinforcer": {
                        "visual_asset": "confetti_cannon",
                        "audio_cue": "harp_glissando_soft",
                        "dopamine_points": 45,
                    },
                    "is_final_step": True,
                },
            ],
            "final_summary": {
                "final_answer_step_id": 3,
                "extracted_final_answer": "Cặp sách đã sẵn sàng cho ngày mai",
                "pedagogical_wrap_up": "Xuất sắc! Cặp sách của con đã sẵn sàng cho một ngày học mới tràn ngập niềm vui!",
            },
        },
    ]


def get_or_create_room_state(room_id: str) -> Dict[str, Any]:
    global ROOM_STATES, TASKS_DB_MAP
    if room_id not in ROOM_STATES:
        default_roadmap = [
            TASKS_DB_MAP.get("G1_MATH_01"),
            TASKS_DB_MAP.get("G1_VIET_03"),
            TASKS_DB_MAP.get("G1_MCQ_04"),
        ]
        default_roadmap = [t for t in default_roadmap if t]
        ROOM_STATES[room_id] = {
            "room_id": room_id,
            "stars": 450,
            "child_roadmap": default_roadmap,
            "current_roadmap_index": 0,
            "current_step_index": 0,
            "pending_ticket": None,
            "selected_catalog_ids": [],
            "pause_count": 0,
            "total_session_seconds": 0,
        }
    return ROOM_STATES[room_id]


@app.on_event("startup")
async def startup_event():
    global CURRICULUM_DATA, PRE_DECOMPOSED_ROUTINES, TASKS_DB_MAP, ROUTINES_DB_MAP
    db.init_db()
    tasks_db_path = REPO_ROOT / "data" / "curriculum" / "tasks_db.json"
    if tasks_db_path.is_file():
        with open(tasks_db_path, "r", encoding="utf-8") as f:
            TASKS_DB_MAP = json.load(f)
        if isinstance(TASKS_DB_MAP, dict):
            CURRICULUM_DATA = {"exercises": list(TASKS_DB_MAP.values())}
        elif isinstance(TASKS_DB_MAP, list):
            CURRICULUM_DATA = {"exercises": TASKS_DB_MAP}
        else:
            CURRICULUM_DATA = {"exercises": []}
        logger.info(f"Loaded {len(TASKS_DB_MAP)} formatted tasks from tasks_db.json (Single Source of Truth).")
    else:
        logger.warning(f"tasks_db.json not found at {tasks_db_path}")

    routines_db_path = REPO_ROOT / "data" / "curriculum" / "routines_db.json"
    if routines_db_path.is_file():
        with open(routines_db_path, "r", encoding="utf-8") as f:
            ROUTINES_DB_MAP = json.load(f)
        logger.info(f"Loaded {len(ROUTINES_DB_MAP)} dedicated daily routines from routines_db.json.")
        if isinstance(TASKS_DB_MAP, dict):
            for r_id, r_val in ROUTINES_DB_MAP.items():
                if r_id not in TASKS_DB_MAP:
                    TASKS_DB_MAP[r_id] = r_val

    PRE_DECOMPOSED_ROUTINES = initialize_pre_decomposed_routines()
    logger.info(f"Loaded {len(PRE_DECOMPOSED_ROUTINES)} pre-decomposed routine tasks.")



# ==========================================
# Pydantic Request / Response Models
# ==========================================

class CreateChildRequest(BaseModel):
    parent_id: Optional[str] = "parent_lan_01"
    name: str
    grade: int = Field(..., ge=1, le=5)
    avatar: Optional[str] = "🦁"
    cognitive_profile: Optional[Dict[str, Any]] = None


class PairingSubmitRequest(BaseModel):
    code: str


class TelemetryUpdateRequest(BaseModel):
    task_initiation_latency_sec: Optional[float] = 5.0
    mistakes_count: Optional[int] = 0
    hints_used: Optional[int] = 0
    actual_duration_sec: Optional[float] = 60.0
    timer_allocated_sec: Optional[float] = 120.0
    focus_duration_min: Optional[float] = 10.0
    post_error_freeze_sec: Optional[float] = 0.0
    milo_rescues_count: Optional[int] = 0
    abandoned_count: Optional[int] = 0
    alpha: Optional[float] = 0.15
    max_delta: Optional[float] = 0.10
    task_id: Optional[str] = None
    step_id: Optional[Any] = None


class ChildStateUpdateRequest(BaseModel):
    stars: Optional[int] = None
    roadmap: Optional[List[Dict[str, Any]]] = None
    child_roadmap: Optional[List[Dict[str, Any]]] = None
    current_roadmap_index: Optional[int] = None
    current_step_index: Optional[int] = None
    pending_ticket: Optional[Dict[str, Any]] = None
    routines: Optional[List[Dict[str, Any]]] = None
    child_routine_roadmap: Optional[List[Dict[str, Any]]] = None
    completed_routine_ids: Optional[List[str]] = None
    photo_proofs: Optional[Dict[str, Any]] = None

class MockLoginRequest(BaseModel):
    role: str = Field(..., description="'parent' hoặc 'kid'")
    username: Optional[str] = "demo_user"
    passcode: Optional[str] = "1234"
    kid_id: Optional[str] = "kid_milo_01"


class MockLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    display_name: str
    family_room_id: str
    active_kid_profile: Optional[Dict[str, Any]] = None
    kid_stats: Optional[Dict[str, Any]] = None


class RecommendedCurriculumResponse(BaseModel):
    total_count: int
    grade_filter: Optional[int] = None
    subject_filter: Optional[str] = None
    exercises: List[Dict[str, Any]]
    routine_tasks: List[Dict[str, Any]]


class DecomposeRequest(BaseModel):
    exercise_id: Optional[str] = Field(None, description="ID bài trong kho (ví dụ: G3_MATH_11)")
    raw_text: Optional[str] = Field(None, description="Đề bài thô nếu nhập tự do")
    grade: Optional[int] = Field(3, ge=1, le=5)
    subject: Optional[str] = Field("toan", description="'toan', 'tieng_viet', 'tieng_anh', 'khoa_hoc_tu_nhien'")
    category: Optional[str] = "Toán lời văn"
    topic: Optional[str] = "Phép tính"
    child_cognitive_profile: Optional[Dict[str, Any]] = None
    survey_scores: Optional[List[int]] = Field(None, description="9 câu trả lời Likert 0-3 từ khảo sát")


class DispatchRequest(BaseModel):
    kid_id: str = "kid_milo_01"
    family_room_id: str = "family_default"
    task_ids: List[str] = Field(..., min_items=1, description="Danh sách ID bài tập và bài sinh hoạt cần giao")
    island_theme: Optional[str] = "Đảo Thần Tiên Milo (Adventure Island)"
    difficulty_mode: Optional[str] = "adaptive"
    parent_note: Optional[str] = "Con yêu hãy hoàn thành từng chặng nhỏ nhé!"


class DispatchResponse(BaseModel):
    dispatch_id: str
    kid_id: str
    island_name: str
    total_stations: int
    total_dopamine_points_available: int
    stations: List[Dict[str, Any]]
    status: str
    dispatched_at: float


# ==========================================
# WebSocket Connection Manager
# ==========================================
class ConnectionManager:
    def __init__(self):
        # room_id -> list of active WebSockets
        self.active_rooms: Dict[str, Set[WebSocket]] = {}
        # websocket -> metadata (role, client_id, room_id)
        self.client_meta: Dict[WebSocket, Dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, role: str, client_id: str, kid_id: Optional[str] = None):
        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = set()
        self.active_rooms[room_id].add(websocket)
        self.client_meta[websocket] = {
            "room_id": room_id,
            "role": role,
            "client_id": client_id,
            "kid_id": kid_id or "",
            "connected_at": str(time.time()),
        }
        logger.info(f"WebSocket client connected: role={role}, client_id={client_id}, room={room_id}, kid_id={kid_id}")

    def disconnect(self, websocket: WebSocket):
        meta = self.client_meta.pop(websocket, None)
        if meta:
            room_id = meta.get("room_id")
            if room_id and room_id in self.active_rooms:
                self.active_rooms[room_id].discard(websocket)
                if not self.active_rooms[room_id]:
                    del self.active_rooms[room_id]
            logger.info(f"WebSocket client disconnected: {meta}")

    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any], exclude: Optional[WebSocket] = None):
        if room_id not in self.active_rooms:
            return
        payload = json.dumps(message, ensure_ascii=False)
        disconnected = []
        for connection in list(self.active_rooms[room_id]):
            if connection != exclude:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.warning(f"Error broadcasting to client: {e}")
                    disconnected.append(connection)
        for dead in disconnected:
            self.disconnect(dead)

    async def send_to_role(self, room_id: str, target_role: str, message: Dict[str, Any]):
        if room_id not in self.active_rooms:
            return
        payload = json.dumps(message, ensure_ascii=False)
        for connection in list(self.active_rooms[room_id]):
            meta = self.client_meta.get(connection, {})
            if meta.get("role") == target_role:
                try:
                    await connection.send_text(payload)
                except Exception:
                    self.disconnect(connection)

    def count_connections(self) -> int:
        return len(self.client_meta)


manager = ConnectionManager()


# ==========================================
# REST API Endpoints
# ==========================================


# ==========================================
# Multi-Child Management REST APIs
# ==========================================
@app.get("/api/parent/children")
async def get_parent_children(parent_id: str = "parent_lan_01"):
    """Lấy danh sách tất cả các con của phụ huynh kèm mã ghép nối 6 số."""
    children = db.get_children_by_parent(parent_id)
    return {"status": "success", "total": len(children), "children": children}


@app.post("/api/parent/children")
async def create_new_child(req: CreateChildRequest):
    """Phụ huynh thêm hồ sơ con mới -> Hệ thống tự sinh mã PIN 6 số ghép nối."""
    new_child = db.create_child(
        parent_id=req.parent_id or "parent_lan_01",
        name=req.name,
        grade=req.grade,
        avatar=req.avatar or "🦁",
        cognitive_profile=req.cognitive_profile,
    )
    # Broadcast cập nhật danh sách con tới các máy phụ huynh
    await manager.broadcast_to_room("family_room_milo_01", {
        "event_type": "CHILDREN_LIST_UPDATED",
        "timestamp": time.time(),
        "child": new_child,
    })
    return {"status": "success", "child": new_child}


@app.post("/api/parent/children/{kid_id}/pairing-code")
async def regenerate_pairing_code(kid_id: str, parent_id: str = "parent_lan_01"):
    """Cấp lại mã PIN 6 số mới cho con khi mã cũ hết hạn."""
    code = db.generate_new_pairing_code(kid_id, parent_id)
    return {"status": "success", "kid_id": kid_id, "pairing_code": code}


@app.post("/api/child/pair")
async def pair_child_device(req: PairingSubmitRequest):
    """Máy con nhập mã PIN 6 số -> Xác thực và nhận profile định danh."""
    profile = db.verify_pairing_code(req.code)
    if not profile:
        raise HTTPException(status_code=400, detail="Mã PIN 6 số không đúng hoặc đã hết hạn.")
    return {"status": "success", "child": profile}


@app.get("/api/child/{kid_id}/state")
async def get_child_state_endpoint(kid_id: str):
    """Lấy toàn bộ trạng thái tiến độ, lộ trình bài học và thói quen của một bé."""
    state = db.get_child_state(kid_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy dữ liệu cho bé '{kid_id}'")
    return state


@app.put("/api/child/{kid_id}/state")
async def update_child_state_endpoint(kid_id: str, req: ChildStateUpdateRequest):
    """Cập nhật trạng thái tiến độ bền vững vào SQLite."""
    if req.stars is not None:
        db.update_child_stars(kid_id, req.stars)
    target_roadmap = req.roadmap if req.roadmap is not None else req.child_roadmap
    if target_roadmap is not None:
        db.save_child_roadmap(
            kid_id,
            target_roadmap,
            req.current_roadmap_index or 0,
            req.current_step_index or 0,
            req.pending_ticket,
        )
    target_routines = req.routines if req.routines is not None else req.child_routine_roadmap
    if target_routines is not None:
        db.save_child_routines(
            kid_id,
            target_routines,
            req.completed_routine_ids,
            req.photo_proofs,
        )
    return {"status": "success", "kid_id": kid_id}

@app.post("/api/child/{kid_id}/telemetry")
async def submit_child_telemetry(kid_id: str, req: TelemetryUpdateRequest):
    """
    Submits real-time behavioral telemetry from child app,
    adapts Cognitive Profile using 5-Tier EMA algorithm,
    persists in SQLite, and broadcasts updated profile to the room.
    """
    from src.adhd_scoring.scoring_service import adaptive_update_cognitive_profile
    child = db.get_child_by_id(kid_id)
    if not child:
        raise HTTPException(status_code=404, detail=f"Child '{kid_id}' not found")
    
    current_profile = child.get("cognitive_profile") or {
        "attention_span_minutes": 10,
        "recommended_micro_task_duration_sec": 120,
        "working_memory_capacity": 2,
        "rsd_sensitivity_level": "HIGH",
        "scaffolding_level": "MODERATE",
    }
    
    updated_profile = adaptive_update_cognitive_profile(
        current_profile=current_profile,
        telemetry_data=req.model_dump(),
        alpha=req.alpha or 0.15,
        max_delta=req.max_delta or 0.10,
    )
    
    db.update_child_cognitive_profile(kid_id, updated_profile)
    db.log_activity(kid_id, "TELEMETRY_ADAPTIVE_UPDATE", {
        "telemetry": req.model_dump(),
        "tier": updated_profile.get("scaffolding_tier"),
        "cdi": updated_profile.get("normalized_indices", {}).get("composite_deficit_index"),
    })
    
    tier_info = updated_profile.get("scaffolding_tier_info", {})
    tier_name = tier_info.get("tier_name", updated_profile.get("scaffolding_tier", "Bậc thích ứng"))
    sync_event = {
        "event_type": "COGNITIVE_PROFILE_UPDATED",
        "timestamp": time.time(),
        "kid_id": kid_id,
        "target_kid_id": kid_id,
        "cognitive_profile": updated_profile,
        "tier_info": tier_info,
        "message": f"Hồ sơ nhận thức của bé đã được cập nhật: {tier_name}",
    }
    await manager.broadcast_to_room("family_room_milo_01", sync_event)
    await manager.broadcast_to_room("family_default", sync_event)
    
    return {
        "status": "success",
        "kid_id": kid_id,
        "cognitive_profile": updated_profile,
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint showing uptime and connected clients."""
    return {
        "status": "online",
        "service": "ADHD Micro-Task Backend",
        "uptime_seconds": round(time.time() - APP_START_TIME, 2),
        "total_active_ws_connections": manager.count_connections(),
        "total_curriculum_exercises": len(CURRICULUM_DATA.get("exercises", [])),
        "total_pre_decomposed_routines": len(PRE_DECOMPOSED_ROUTINES),
    }


@app.post("/api/auth/mock-login", response_model=MockLoginResponse)
async def mock_login(req: MockLoginRequest):
    """
    Mock authentication endpoint for Parent and Kid devices.
    Returns simulated JWT token, user profile, and family room link.
    """
    role = req.role.lower().strip()
    if role not in ["parent", "kid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'parent' or 'kid'",
        )

    token = f"mock_token_{role}_{uuid4().hex[:12]}"
    family_room_id = "family_room_milo_01"

    if role == "parent":
        display_name = "Phụ huynh bé Milo (Mẹ Lan)"
        user_id = "parent_lan_01"
        active_kid_profile = {
            "kid_id": req.kid_id,
            "kid_name": "Bé Milo",
            "grade": 3,
            "adhd_subtype": "Dễ xao nhãng & Nhạy cảm thất bại (RSD High)",
            "attention_span_minutes": 10,
            "recommended_duration_sec": 120,
            "working_memory_capacity": 2,
        }
        kid_stats = None
    else:
        display_name = "Bé Milo Dũng Cảm"
        user_id = req.kid_id or "kid_milo_01"
        active_kid_profile = None
        kid_stats = {
            "kid_id": user_id,
            "current_island": "Đảo Khám Phá Rừng Xanh",
            "dopamine_points": 340,
            "stars_earned": 18,
            "current_streak_days": 4,
            "companion_milo_mood": "very_happy",
        }

    return MockLoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user_id,
        role=role,
        display_name=display_name,
        family_room_id=family_room_id,
        active_kid_profile=active_kid_profile,
        kid_stats=kid_stats,
    )


@app.get("/api/curriculum/recommended", response_model=RecommendedCurriculumResponse)
async def get_recommended_curriculum(
    grade: Optional[int] = Query(None, ge=1, le=5, description="Lọc theo khối lớp 1-5"),
    subject: Optional[str] = Query(None, description="Lọc theo môn: toan, tieng_viet, tieng_anh, khoa_hoc_tu_nhien"),
    category: Optional[str] = Query(None, description="Lọc theo dạng bài"),
    include_routines: bool = Query(True, description="Kèm các bài sinh hoạt đời thường đã băm sẵn"),
):
    """
    Returns GDPT 2018 Elementary Benchmark Exercises (Grade 1-5)
    and pre-decomposed daily life habit routines.
    """
    exercises = CURRICULUM_DATA.get("exercises", [])

    filtered_exercises = []
    for ex in exercises:
        if grade is not None and ex.get("grade") != grade:
            continue
        if subject:
            s_map = map_subject_code(ex.get("subject", ""))
            q_map = map_subject_code(subject)
            if s_map != q_map:
                continue
        if category and category.lower() not in ex.get("category", "").lower():
            continue
        filtered_exercises.append(ex)

    filtered_routines = []
    if include_routines:
        for r in PRE_DECOMPOSED_ROUTINES:
            if grade is not None and r.get("grade") != grade:
                continue
            filtered_routines.append(r)

    return RecommendedCurriculumResponse(
        total_count=len(filtered_exercises) + len(filtered_routines),
        grade_filter=grade,
        subject_filter=subject,
        exercises=filtered_exercises,
        routine_tasks=filtered_routines,
    )


@app.get("/api/routines", response_model=RoutinesListResponse)
async def get_daily_routines():
    """Lấy danh sách các bài sinh hoạt đời thường phân nhóm theo timeline slot."""
    routines_list = list(ROUTINES_DB_MAP.values())
    by_slot = {
        "morning": [],
        "afternoon": [],
        "evening": [],
        "night": [],
    }
    for r in routines_list:
        slot = r.get("timeline_slot", "morning")
        if slot not in by_slot:
            by_slot[slot] = []
        by_slot[slot].append(r)
    return RoutinesListResponse(
        total_routines=len(routines_list),
        timeline_slots=list(by_slot.keys()),
        routines_by_slot=by_slot,
        routines=routines_list,
    )


@app.get("/api/routines/{routine_id}", response_model=DailyRoutineModel)
async def get_daily_routine_detail(routine_id: str):
    """Lấy chi tiết 1 bài thói quen theo ID."""
    if routine_id not in ROUTINES_DB_MAP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Routine '{routine_id}' not found in routines_db.json",
        )
    return ROUTINES_DB_MAP[routine_id]


@app.post("/api/routines/proof")
async def submit_routine_proof(req: RoutineProofSubmitRequest):
    """Bé nộp ảnh minh chứng 1-chạm -> Hệ thống tự động ghi nhận và thông báo ngầm sang Mẹ."""
    if req.routine_id not in ROUTINES_DB_MAP:
        raise HTTPException(status_code=404, detail="Routine not found")
    routine = ROUTINES_DB_MAP[req.routine_id]
    event_payload = {
        "event_type": "ROUTINE_PHOTO_SUBMITTED",
        "routine_id": req.routine_id,
        "routine_title": routine.get("title"),
        "kid_id": req.kid_id,
        "photo_tag": req.photo_tag or routine.get("target_photo_tag"),
        "timestamp": req.timestamp or time.strftime("%H:%M"),
        "reward_stars": routine.get("reward", 25)
    }
    await manager.broadcast_to_room("family_default", event_payload)
    return {"status": "success", "message": "Minh chứng đã gửi vào Nhật ký của Mẹ!", "data": event_payload}


@app.post("/api/routines/heart")
async def send_routine_heart_cheer(req: RoutineHeartCheerRequest):
    """Mẹ thả tim khen ngợi thói quen tự giác của con."""
    event_payload = {
        "event_type": "ROUTINE_HEART_RECEIVED",
        "routine_id": req.routine_id,
        "parent_id": req.parent_id,
        "praise_message": req.praise_message,
        "bonus_stars": req.bonus_stars,
    }
    await manager.broadcast_to_room("family_default", event_payload)
    return {"status": "success", "message": "Đã gửi tim yêu thương sang máy của con!", "data": event_payload}


@app.get("/api/curriculum/tasks")
async def get_curriculum_tasks():
    """
    Returns the full dictionary of formatted tasks (25 GDPT 2018 + 4 Routines)
    directly loaded from data/curriculum/tasks_db.json. Single Source of Truth.
    """
    global TASKS_DB_MAP
    if not TASKS_DB_MAP:
        tasks_db_path = REPO_ROOT / "data" / "curriculum" / "tasks_db.json"
        if tasks_db_path.is_file():
            with open(tasks_db_path, "r", encoding="utf-8") as f:
                TASKS_DB_MAP = json.load(f)
    return TASKS_DB_MAP


@app.post("/api/tasks/decompose")

async def decompose_task(req: DecomposeRequest):
    """
    Receives raw exercise or curriculum ID and decomposes it into micro-tasks
    strictly conforming to schemas/micro_task_schema.json using the Unified Fast-Path
    AI Engine (powered by prompts/micro_task_decomposer.md).
    """
    exercise_dict: Dict[str, Any] = {}

    # Case 1: Look up by exercise_id in curriculum
    if req.exercise_id:
        for ex in CURRICULUM_DATA.get("exercises", []):
            if ex.get("id") == req.exercise_id:
                exercise_dict = ex.copy()
                break
        # Also check pre-decomposed routines
        if not exercise_dict:
            for r in PRE_DECOMPOSED_ROUTINES:
                if r.get("id") == req.exercise_id:
                    return r  # Return pre-decomposed directly

    # Case 2: Construct ad-hoc exercise from raw text
    if not exercise_dict:
        if not req.raw_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'exercise_id' or 'raw_text' must be provided.",
            )
        exercise_dict = {
            "id": f"ADHOC_{uuid4().hex[:8].upper()}",
            "grade": req.grade or 3,
            "subject": req.subject or "Toán",
            "category": req.category or "Toán lời văn",
            "topic": req.topic or "Bài tập giải toán",
            "original_text": req.raw_text,
            "options": None,
            "final_answer": {"normalized_display": "Hoàn thành bài tập"},
            "ground_truth_steps": [
                {"instruction": req.raw_text[:120], "intermediate_output": "Kết quả"}
            ],
            "adhd_scaffolding_notes": {
                "working_memory_pitfall": "Dễ xao nhãng khi đọc nhiều câu.",
                "executive_function_scaffolding": "Chia nhỏ thành từng bước trực tiếp.",
            },
        }

    # Derive cognitive profile
    profile = req.child_cognitive_profile
    if not profile and req.survey_scores:
        try:
            survey_res = ScoringService.compute_profile_from_answers(req.survey_scores)
            profile = survey_res.get("profile_vector", {})
        except Exception as e:
            logger.warning(f"Error computing profile from survey: {e}")

    if not profile:
        profile = {
            "cognitive_profile_vector": {
                "attention_span_minutes": 10,
                "recommended_micro_task_duration_sec": 120,
                "working_memory_capacity": 2,
                "rsd_sensitivity_level": "HIGH",
                "scaffolding_level": "MODERATE",
                "max_steps_per_session": 4,
            }
        }

    # Execute Real AI Decomposition with Gemini 3.5 Flash Lite (Rẻ nhất, chuẩn xác nhất, KHÔNG FALLBACK GIẢ)
    try:
        from src.api.ai_engine import decompose_exercise_with_gemini
        decomposed_session = await decompose_exercise_with_gemini(
            raw_text=exercise_dict.get("original_text", req.raw_text or ""),
            grade=exercise_dict.get("grade", 3),
            cognitive_profile=profile.get("cognitive_profile_vector", {}) if profile else {}
        )
        return decomposed_session
    except Exception as e:
        logger.error(f"Lỗi AI phân rã: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi phân rã AI từ Gemini: {str(e)}"
        )


@app.post("/api/tasks/dispatch", response_model=DispatchResponse)
async def dispatch_tasks_to_kid(req: DispatchRequest):
    """
    Parent assigns a batch of exercises/routines to Kid.
    Generates gamified 'Island Route' (Lộ trình Đảo) and broadcasts to Kid device via WebSocket.
    """
    dispatch_id = f"DISPATCH_{uuid4().hex[:8].upper()}"
    stations: List[Dict[str, Any]] = []
    total_dopamine = 0

    all_exercises_map = {ex["id"]: ex for ex in CURRICULUM_DATA.get("exercises", [])}
    for r in PRE_DECOMPOSED_ROUTINES:
        all_exercises_map[r["id"]] = r

    dispatched_tasks = []
    for idx, tid in enumerate(req.task_ids, start=1):
        item = all_exercises_map.get(tid)
        title = item.get("title", item.get("topic", item.get("category", f"Nhiệm vụ {idx}"))) if item else f"Nhiệm vụ {idx}"
        pts = 50 + (idx * 10)
        total_dopamine += pts

        inst_id = f"inst_{tid}_{int(time.time()*1000)}_{idx}"
        station_info = {
            "station_id": idx,
            "station_name": f"Trạm {idx}: {title[:35]}",
            "task_id": tid,
            "instance_id": inst_id,
            "status": "active" if idx == 1 else "locked",
            "coordinates": {"x": 20 + (idx * 22) % 70, "y": 30 + (idx * 18) % 55},
            "stars_reward": 3,
            "dopamine_points": pts,
            "milo_guidance": "Milo đang đứng chờ con ở trạm này nè!",
        }
        stations.append(station_info)

        # Build full clean task object with instance_id and reset step
        task_obj = copy.deepcopy(item) if item else {"id": tid, "title": title, "steps": []}
        task_obj["instance_id"] = inst_id
        task_obj["current_step_index"] = 0
        task_obj["status"] = "active" if idx == 1 else "locked"
        dispatched_tasks.append(task_obj)

    # Persist directly into SQLite child_roadmaps table for this specific child
    db.save_child_roadmap(
        kid_id=req.kid_id,
        roadmap=dispatched_tasks,
        current_roadmap_index=0,
        current_step_index=0,
        pending_ticket=None
    )

    response_payload = DispatchResponse(
        dispatch_id=dispatch_id,
        kid_id=req.kid_id,
        island_name=req.island_theme or "Đảo Thần Tiên Milo (Adventure Island)",
        total_stations=len(stations),
        total_dopamine_points_available=total_dopamine,
        stations=stations,
        status="dispatched",
        dispatched_at=time.time(),
    )

    # Broadcast to Kid App via WebSocket
    sync_event = {
        "event_type": "NEW_DISPATCH_ROUTE",
        "timestamp": time.time(),
        "sender": "parent",
        "kid_id": req.kid_id,
        "target_kid_id": req.kid_id,
        "data": response_payload.model_dump(),
        "roadmap": dispatched_tasks,
        "force_reset": True,
        "alert_message": f"Mẹ vừa gửi cho con 1 bản đồ Đảo mới: {response_payload.island_name}!",
    }
    await manager.broadcast_to_room(req.family_room_id, sync_event)
    logger.info(f"Dispatched route {dispatch_id} to room {req.family_room_id}")

    return response_payload


# ==========================================
# WebSocket Real-Time Synchronization Endpoint
# ==========================================
@app.websocket("/ws/sync")
async def websocket_sync_endpoint(
    websocket: WebSocket,
    room_id: str = Query("family_room_milo_01"),
    role: str = Query("kid"),
    client_id: str = Query(None),
    kid_id: Optional[str] = Query(None),
):
    """
    Two-way real-time WebSocket connection to synchronize Parent & Kid devices:
    - Kid answers step -> notifies Parent device in real-time.
    - Parent taps cheer/encouragement -> Milo plays reward animation on Kid screen.
    - Parent dispatches new route -> Kid map updates automatically.
    """
    cid = client_id or f"{role}_{uuid4().hex[:6]}"
    active_kid = kid_id or "kid_leo_01"
    await manager.connect(websocket, room_id=room_id, role=role, client_id=cid, kid_id=active_kid)
    child_db_state = db.get_child_state(active_kid)
    room_state = get_or_create_room_state(room_id)
    if child_db_state:
        room_state["kid_id"] = active_kid
        room_state["stars"] = child_db_state.get("stars", room_state.get("stars", 450))
        if child_db_state.get("child_roadmap"):
            room_state["child_roadmap"] = child_db_state["child_roadmap"]
            room_state["current_roadmap_index"] = child_db_state.get("current_roadmap_index", 0)
            room_state["current_step_index"] = child_db_state.get("current_step_index", 0)
        if child_db_state.get("child_routine_roadmap"):
            room_state["child_routine_roadmap"] = child_db_state["child_routine_roadmap"]
        if child_db_state.get("routine_photo_proofs"):
            room_state["routine_photo_proofs"] = child_db_state["routine_photo_proofs"]

    # Child-scoped initial state for handshake
    child_init_state = {
        "kid_id": active_kid,
        "stars": child_db_state.get("stars", 450) if child_db_state else 450,
        "child_roadmap": child_db_state.get("child_roadmap", []) if child_db_state else [],
        "current_roadmap_index": child_db_state.get("current_roadmap_index", 0) if child_db_state else 0,
        "current_step_index": child_db_state.get("current_step_index", 0) if child_db_state else 0,
        "child_routine_roadmap": child_db_state.get("child_routine_roadmap", []) if child_db_state else [],
        "routine_photo_proofs": child_db_state.get("routine_photo_proofs", {}) if child_db_state else {},
        "pending_ticket": child_db_state.get("pending_ticket") if child_db_state else None,
    }

    # 1. Send initial welcome handshake with server-authoritative child-scoped state
    await websocket.send_text(json.dumps({
        "event_type": "CONNECTION_ESTABLISHED",
        "client_id": cid,
        "role": role,
        "room_id": room_id,
        "kid_id": active_kid,
        "target_kid_id": active_kid,
        "timestamp": time.time(),
        "message": f"Chào mừng {role} đã kết nối vào phòng gia đình {room_id}!",
        "state": child_init_state,
    }, ensure_ascii=False))

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
                continue

            event_type = data.get("event_type", "UNKNOWN")
            logger.info(f"Received WS event '{event_type}' from {role} ({cid}) in room {room_id}")

            # 1. Heartbeat
            if event_type == "PING":
                await websocket.send_text(json.dumps({"event_type": "PONG", "timestamp": time.time()}))
                continue

            # 2. Explicit request for room state hydration
            if event_type in ("GET_ROOM_STATE", "SYNC_REQUEST", "REQUEST_HYDRATE"):
                await websocket.send_text(json.dumps({
                    "event_type": "ROOM_STATE_HYDRATE",
                    "room_id": room_id,
                    "role": role,
                    "timestamp": time.time(),
                    "state": room_state,
                }, ensure_ascii=False))
                continue


            # Determine target/source kid_id for this event
            payload_dict = data.get("payload", {}) if isinstance(data.get("payload"), dict) else {}
            ev_kid_id = (
                data.get("target_kid_id")
                or data.get("kid_id")
                or payload_dict.get("target_kid_id")
                or payload_dict.get("kid_id")
                or active_kid
            )

            # 2. State-mutating events: update in-memory room state scoped to kid
            if event_type == "TASK_ASSIGN_BATCH":
                new_tasks = payload_dict.get("tasks", [])
                if not new_tasks and isinstance(data.get("tasks"), list):
                    new_tasks = data.get("tasks")
                if new_tasks:
                    db.save_child_roadmap(ev_kid_id, new_tasks, 0, 0)
                    if ev_kid_id == active_kid:
                        room_state["child_roadmap"] = new_tasks
                        room_state["current_roadmap_index"] = 0
                        room_state["current_step_index"] = 0
            elif event_type in ("KID_STEP_COMPLETED", "STEP_TELEMETRY_UPDATE"):
                step_id = data.get("step_id")
                points = data.get("dopamine_points", 25)
                if ev_kid_id == active_kid and event_type == "KID_STEP_COMPLETED":
                    room_state["stars"] = room_state.get("stars", 450) + points
                    room_state["current_step_index"] = room_state.get("current_step_index", 0) + 1
                
                # Check for adaptive telemetry in payload
                telemetry = data.get("telemetry") or payload_dict.get("telemetry")
                if telemetry and isinstance(telemetry, dict):
                    try:
                        from src.adhd_scoring.scoring_service import adaptive_update_cognitive_profile
                        c_rec = db.get_child_by_id(ev_kid_id)
                        if c_rec:
                            cur_prof = c_rec.get("cognitive_profile") or {}
                            new_prof = adaptive_update_cognitive_profile(cur_prof, telemetry, alpha=0.15, max_delta=0.10)
                            db.update_child_cognitive_profile(ev_kid_id, new_prof)
                            t_info = new_prof.get("scaffolding_tier_info", {})
                            await manager.broadcast_to_room(room_id, {
                                "event_type": "COGNITIVE_PROFILE_UPDATED",
                                "timestamp": time.time(),
                                "kid_id": ev_kid_id,
                                "target_kid_id": ev_kid_id,
                                "cognitive_profile": new_prof,
                                "tier_info": t_info,
                                "message": f"Hồ sơ nhận thức đã thích ứng: {t_info.get('tier_name', '')}",
                            })
                    except Exception as e:
                        logger.warning(f"Error in WS telemetry adaptive update: {e}")
            elif event_type == "KID_TASK_COMPLETED":
                if ev_kid_id == active_kid:
                    room_state["current_roadmap_index"] = room_state.get("current_roadmap_index", 0) + 1
                    room_state["current_step_index"] = 0
            elif event_type == "STARS_SYNC":
                new_stars = payload_dict.get("totalStars")
                if new_stars is not None and ev_kid_id == active_kid:
                    room_state["stars"] = int(new_stars)
            elif event_type == "TICKET_REDEEM":
                payload = data.get("payload", {})
                room_state["pending_ticket"] = payload.get("ticket") if isinstance(payload, dict) else data.get("ticket")
            elif event_type == "TICKET_APPROVE":
                room_state["pending_ticket"] = None
            elif event_type == "ROADMAP_UPDATED":
                new_roadmap = payload_dict.get("roadmap", [])
                cur_idx = payload_dict.get("currentIdx", 0)
                db.save_child_roadmap(ev_kid_id, new_roadmap, cur_idx, 0)
                if ev_kid_id == active_kid:
                    room_state["child_roadmap"] = new_roadmap
                    room_state["current_roadmap_index"] = cur_idx
                    room_state["current_step_index"] = 0
                    room_state["roadmap_cleared"] = (len(new_roadmap) == 0)
            elif event_type == "ROUTINE_ASSIGN_BATCH":
                new_routines = payload_dict.get("routines", [])
                db.save_child_routines(ev_kid_id, new_routines, [], {})
                if ev_kid_id == active_kid:
                    room_state["child_routine_roadmap"] = new_routines
                    room_state["routine_cleared"] = (len(new_routines) == 0)

            # Kid completes a micro-task step -> Notify Parent
            if event_type == "KID_STEP_COMPLETED":
                step_id = data.get("step_id")
                points = data.get("dopamine_points", 25)
                forward_event = {
                    "event_type": "PARENT_NOTIFICATION_STEP_DONE",
                    "timestamp": time.time(),
                    "sender": cid,
                    "kid_id": ev_kid_id,
                    "target_kid_id": ev_kid_id,
                    "step_id": step_id,
                    "points_earned": points,
                    "message": f"Bé vừa hoàn thành xuất sắc Bước {step_id}! (+{points} điểm Dopamine)",
                }
                await manager.send_to_role(room_id, target_role="parent", message=forward_event)

            # Parent sends encouragement sticker/cheer -> Notify Kid
            elif event_type == "PARENT_CHEER":
                cheer_text = data.get("cheer_text", "Bố mẹ rất tự hào về sự kiên trì của con!")
                sticker = data.get("sticker", "milo_thumbs_up")
                forward_event = {
                    "event_type": "KID_RECEIVE_CHEER",
                    "timestamp": time.time(),
                    "sender": cid,
                    "kid_id": ev_kid_id,
                    "target_kid_id": ev_kid_id,
                    "cheer_text": cheer_text,
                    "sticker": sticker,
                    "milo_audio": "harp_glissando_soft",
                }
                await manager.send_to_role(room_id, target_role="kid", message=forward_event)

            # Broadcast general events to all peers in the room
            else:
                broadcast_data = {
                    "event_type": event_type,
                    "sender": cid,
                    "sender_role": role,
                    "timestamp": time.time(),
                    "kid_id": ev_kid_id,
                    "target_kid_id": ev_kid_id,
                    "payload": data.get("payload", data),
                }
                await manager.broadcast_to_room(room_id, broadcast_data, exclude=websocket)


    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket client {cid} cleanly disconnected.")
    except Exception as e:
        logger.warning(f"WebSocket exception for {cid}: {e}")
        manager.disconnect(websocket)


# ==========================================
# Mount Static Frontend from app/
# ==========================================
from fastapi.staticfiles import StaticFiles

app_path = REPO_ROOT / "app"
data_path = REPO_ROOT / "data"

if data_path.is_dir():
    app.mount("/data", StaticFiles(directory=str(data_path)), name="static_data")

if app_path.is_dir():
    app.mount("/", StaticFiles(directory=str(app_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("🚀 MILO QUEST × TRẠM THẤU HIỂU BACKEND & FRONTEND SERVER")
    print("📍 URL Trình Duyệt: http://localhost:8000")
    print("📍 API Swagger Docs: http://localhost:8000/docs")
    print("📍 WebSocket Sync:   ws://localhost:8000/ws/sync")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)

