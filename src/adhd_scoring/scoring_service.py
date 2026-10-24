"""
Production Scoring Module for ADHD 9-Question Parent Survey.

Transforms clinical responses (Likert 0-3) based on Vanderbilt VADPRS, SNAP-IV,
and Barkley Emotional Dysregulation framework into continuous and categorical
Cognitive Profile vectors for GDPT 2018 elementary micro-task scaffolding.
Supports real-time adaptive EMA cognitive profile updates from student telemetry.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Union


def get_default_survey_path() -> Path:
    """Returns the default path to the survey definition JSON file."""
    current_file = Path(__file__).resolve()
    repo_root = current_file.parents[2]
    return repo_root / "data" / "surveys" / "adhd_parent_survey.json"


def load_survey_definition(survey_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    """Loads and parses the ADHD parent survey definition JSON."""
    path = Path(survey_path) if survey_path else get_default_survey_path()
    if not path.is_file():
        raise FileNotFoundError(f"ADHD survey definition file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "questions" not in data or len(data["questions"]) != 9:
        raise ValueError(
            f"Invalid survey definition: expected exactly 9 questions, got "
            f"{len(data.get('questions', []))}"
        )
    return data


def validate_survey_answers(answers: Union[Dict[str, Any], List[int]]) -> Dict[str, int]:
    """Validates and normalizes 9 survey answers."""
    normalized: Dict[str, int] = {}

    if isinstance(answers, (list, tuple)):
        if len(answers) != 9:
            raise ValueError(f"Expected exactly 9 answers in list, got {len(answers)}")
        for idx, val in enumerate(answers, start=1):
            normalized[f"q{idx}"] = val
    elif isinstance(answers, dict):
        for i in range(1, 10):
            str_key = f"q{i}"
            num_key = i
            str_num_key = str(i)

            if str_key in answers:
                normalized[str_key] = answers[str_key]
            elif num_key in answers:
                normalized[str_key] = answers[num_key]
            elif str_num_key in answers:
                normalized[str_key] = answers[str_num_key]
            else:
                raise ValueError(f"Missing required survey question {str_key}")
    else:
        raise TypeError(f"Answers must be a dict or list/tuple, got {type(answers).__name__}")

    for k, v in normalized.items():
        if isinstance(v, bool):
            raise ValueError(f"Question {k} score cannot be a boolean: {v}")
        if not isinstance(v, (int, float)):
            raise ValueError(f"Question {k} score must be numeric, got {type(v).__name__}: {v}")
        if isinstance(v, float):
            if not v.is_integer():
                raise ValueError(f"Question {k} score must be an integer, got float {v}")
            v = int(v)
            normalized[k] = v
        if v < 0 or v > 3:
            raise ValueError(f"Question {k} score must be in range [0, 3], got {v}")

    return normalized


def resolve_scaffolding_tier(cdi: float, wm: int) -> Dict[str, Any]:
    """
    Maps continuous Composite Deficit Index (CDI in [0.0, 1.0]) and Working Memory (1-5)
    to the 5-Tier Adaptive Scaffolding Spectrum:
      - Tier 1: Ultra-Atomic (5 vi bước siêu nhỏ) - CDI >= 0.75 or WM <= 1
      - Tier 2: High Scaffolding (4 vi bước chuẩn GDPT) - 0.55 <= CDI < 0.75 or WM == 2
      - Tier 3: Balanced (3 vi bước gộp) - 0.35 <= CDI < 0.55 or WM == 3
      - Tier 4: Guided Independence (2 bước tự lập có định hướng) - 0.20 <= CDI < 0.35 or WM == 4
      - Tier 5: Full Mastery (1 bước giải hoàn chỉnh + 1 thử thách) - CDI < 0.20 or WM == 5
    """
    if cdi >= 0.75 or wm <= 1:
        return {
            "tier_id": 1,
            "scaffolding_tier": "TIER_1_ULTRA_ATOMIC",
            "tier_name": "Siêu phân rã (Ultra-Atomic)",
            "scaffolding_level": "INTENSIVE",
            "target_step_count": 5,
            "option_count": 2,
            "auto_hint_delay_sec": 12,
            "error_masking": True,
            "pedagogical_focus": "Băm nhỏ tối đa 5 bước, mỗi bước 1 thao tác cơ học duy nhất, 1 động từ đơn, triệt tiêu phân tâm.",
        }
    elif cdi >= 0.55 or wm == 2:
        return {
            "tier_id": 2,
            "scaffolding_tier": "TIER_2_HIGH_SCAFFOLD",
            "tier_name": "Giàn giáo chuyên sâu (High Scaffold)",
            "scaffolding_level": "INTENSIVE",
            "target_step_count": 4,
            "option_count": 3,
            "auto_hint_delay_sec": 20,
            "error_masking": True,
            "pedagogical_focus": "Chuẩn 4 bước GDPT 2018: Gạch chân đầy đủ -> Cầu nối nhận thức -> Chọn phép tính -> Tính toán.",
        }
    elif cdi >= 0.35 or wm == 3:
        return {
            "tier_id": 3,
            "scaffolding_tier": "TIER_3_BALANCED",
            "tier_name": "Giàn giáo cân bằng (Balanced)",
            "scaffolding_level": "MODERATE",
            "target_step_count": 3,
            "option_count": 4,
            "auto_hint_delay_sec": 0,
            "error_masking": False,
            "pedagogical_focus": "Rút gọn thành 3 bước: Đọc và chọn phép tính -> Đặt tính và tính nhẩm -> Kết luận danh số.",
        }
    elif cdi >= 0.20 or wm == 4:
        return {
            "tier_id": 4,
            "scaffolding_tier": "TIER_4_GUIDED",
            "tier_name": "Tự lập có hướng dẫn (Guided Independence)",
            "scaffolding_level": "MINIMAL",
            "target_step_count": 2,
            "option_count": 4,
            "auto_hint_delay_sec": 0,
            "error_masking": False,
            "pedagogical_focus": "Rút xuống 2 bước: Tự lập biểu thức và tính đáp số trong 1 card -> Ghi đáp số đầy đủ.",
        }
    else:
        return {
            "tier_id": 5,
            "scaffolding_tier": "TIER_5_MASTERY",
            "tier_name": "Tự chủ & Mở rộng (Full Mastery)",
            "scaffolding_level": "MINIMAL",
            "target_step_count": 1,
            "option_count": 4,
            "auto_hint_delay_sec": 0,
            "error_masking": False,
            "pedagogical_focus": "Trẻ tự lập hoàn toàn: 1 bước giải trọn vẹn và 1 câu hỏi thử thách mở rộng/phản biện.",
        }


def calculate_cognitive_profile(
    answers: Union[Dict[str, Any], List[int]],
    child_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Transforms 9-question survey answers into normalized continuous and categorical Cognitive Profile vectors."""
    clean_answers = validate_survey_answers(answers)

    metadata = {
        "child_name": "Học sinh",
        "grade": 3,
        "age": 8,
    }
    if child_metadata:
        metadata.update(child_metadata)

    # 1. Raw Subscale Scores
    ef_score = clean_answers["q1"] + clean_answers["q2"] + clean_answers["q3"]
    as_score = clean_answers["q4"] + clean_answers["q5"] + clean_answers["q6"]
    rsd_score = clean_answers["q7"] + clean_answers["q8"] + clean_answers["q9"]
    total_score = ef_score + as_score + rsd_score

    # 2. Normalized Indices [0.0, 1.0]
    ef_index = round(ef_score / 9.0, 4)
    as_index = round(as_score / 9.0, 4)
    rsd_index = round(rsd_score / 9.0, 4)
    cdi = round((0.40 * ef_index) + (0.35 * as_index) + (0.25 * rsd_index), 4)

    # 3. Attention Span (minutes) [5 to 25 minutes]
    raw_span = 25.0 - (as_score / 9.0) * 20.0
    attention_span_minutes = max(5, min(25, int(round(raw_span))))

    # 4. Recommended Micro-Task Duration (seconds) [60 to 300 seconds, rounded to 30s]
    raw_micro_duration = 300.0 - (as_score / 9.0) * 210.0
    recommended_duration = int(round(raw_micro_duration / 30.0) * 30)
    recommended_micro_task_duration_sec = max(60, min(300, recommended_duration))

    # 5. Working Memory Capacity (chunks) [1 to 5 chunks]
    raw_wm = 5.0 - (ef_score / 9.0) * 4.0
    working_memory_capacity = max(1, min(5, int(round(raw_wm))))

    # 6. RSD Sensitivity Level
    if rsd_score <= 2:
        rsd_sensitivity_level = "LOW"
    elif rsd_score <= 4:
        rsd_sensitivity_level = "MEDIUM"
    elif rsd_score <= 7:
        rsd_sensitivity_level = "HIGH"
    else:
        rsd_sensitivity_level = "SEVERE"

    # 7. Scaffolding Level & Max Steps (Preserve backward compatibility)
    if cdi < 0.35:
        scaffolding_level = "MINIMAL"
        max_steps = 6
    elif cdi < 0.70:
        scaffolding_level = "MODERATE"
        max_steps = 4
    else:
        scaffolding_level = "INTENSIVE"
        max_steps = 3

    tier_info = resolve_scaffolding_tier(cdi, working_memory_capacity)
    scaffolding_tier = tier_info["scaffolding_tier"]

    # 8. Behavioral Directives for Prompt Injection
    verb_constraint = (
        "CHỈ được dùng ĐÚNG 1 động từ hành động duy nhất trong mỗi micro-task (ví dụ: 'Đọc', 'Gạch chân', 'Tính')."
        if working_memory_capacity <= 2
        else "Mỗi micro-task tối đa 1-2 động từ hành động liên kết trực tiếp."
    )

    rsd_tone_guideline = (
        "Áp dụng giao thức hạ nhiệt RSD tối đa: Không phê phán, không dùng từ 'sai', dùng giọng điệu ấm áp của robot Milo, tự động kích hoạt lời khen nỗ lực sau mỗi bước."
        if rsd_sensitivity_level in ["HIGH", "SEVERE"]
        else "Giọng điệu khích lệ tích cực, khen ngợi quy trình làm bài."
    )

    prompt_directives = {
        "scaffolding_tier": scaffolding_tier,
        "scaffolding_level": scaffolding_level,
        "max_atomic_steps": max_steps,
        "target_tier_step_count": tier_info["target_step_count"],
        "step_duration_target_sec": recommended_micro_task_duration_sec,
        "cognitive_chunk_limit": working_memory_capacity,
        "verb_constraint": verb_constraint,
        "rsd_tone_guideline": rsd_tone_guideline,
        "visual_timer_interval_sec": recommended_micro_task_duration_sec,
        "tier_info": tier_info,
    }

    system_instruction_context = (
        f"HỌC SINH CÓ HỒ SƠ NHẬN THỨC: Phân bậc {tier_info['tier_name']}. "
        f"Sức chứa trí nhớ làm việc: {working_memory_capacity} chunks. "
        f"Khoảng chú ý hữu dụng: {attention_span_minutes} phút (Micro-task tối đa {recommended_micro_task_duration_sec}s). "
        f"Độ nhạy cảm thất bại (RSD): {rsd_sensitivity_level}. Mức giàn giáo sư phạm: {scaffolding_level}. "
        f"Yêu cầu phân rã: Tối đa {max_steps} bước vi nhiệm vụ. {verb_constraint} {rsd_tone_guideline}"
    )

    cognitive_vector = {
        "attention_span_minutes": attention_span_minutes,
        "recommended_micro_task_duration_sec": recommended_micro_task_duration_sec,
        "working_memory_capacity": working_memory_capacity,
        "rsd_sensitivity_level": rsd_sensitivity_level,
        "scaffolding_level": scaffolding_level,
        "scaffolding_tier": scaffolding_tier,
        "max_steps_per_session": max_steps,
    }

    return {
        "attention_span_minutes": attention_span_minutes,
        "recommended_micro_task_duration_sec": recommended_micro_task_duration_sec,
        "working_memory_capacity": working_memory_capacity,
        "rsd_sensitivity_level": rsd_sensitivity_level,
        "scaffolding_level": scaffolding_level,
        "scaffolding_tier": scaffolding_tier,
        "scaffolding_tier_info": tier_info,
        "max_steps_per_session": max_steps,
        "prompt_injection_directives": prompt_directives,
        "survey_metadata": {
            "survey_id": "adhd_vadprs_snapiv_9q",
            "version": "1.0.0",
            "child_name": metadata["child_name"],
            "grade": metadata["grade"],
            "age": metadata["age"],
        },
        "raw_scores": {
            "executive_function": ef_score,
            "attention_span": as_score,
            "rsd_sensitivity": rsd_score,
            "total_score": total_score,
        },
        "normalized_indices": {
            "executive_function_deficit_index": ef_index,
            "attention_decay_index": as_index,
            "rejection_sensitivity_index": rsd_index,
            "composite_deficit_index": cdi,
        },
        "cognitive_profile_vector": cognitive_vector,
        "stage_2_prompt_injection_payload": {
            "system_instruction_context": system_instruction_context
        },
    }


def adaptive_update_cognitive_profile(
    current_profile: Dict[str, Any],
    telemetry_data: Dict[str, Any],
    alpha: float = 0.15,
    max_delta: float = 0.10,
) -> Dict[str, Any]:
    """
    Dynamically updates the Cognitive Profile using real telemetry observations
    via an Exponential Moving Average (EMA) with Max-Delta Guardrail.
    """
    norm_indices = current_profile.get("normalized_indices", {})
    if norm_indices and "executive_function_deficit_index" in norm_indices:
        cur_ef = float(norm_indices.get("executive_function_deficit_index", 0.5))
        cur_as = float(norm_indices.get("attention_decay_index", 0.5))
        cur_rsd = float(norm_indices.get("rejection_sensitivity_index", 0.5))
    else:
        wm = current_profile.get("working_memory_capacity", 2)
        cur_ef = max(0.0, min(1.0, (5.0 - wm) / 4.0))
        span = current_profile.get("attention_span_minutes", 12)
        cur_as = max(0.0, min(1.0, (25.0 - span) / 20.0))
        rsd_level = current_profile.get("rsd_sensitivity_level", "HIGH")
        rsd_map = {"LOW": 0.15, "MEDIUM": 0.40, "HIGH": 0.65, "SEVERE": 0.90}
        cur_rsd = rsd_map.get(rsd_level, 0.60)

    t_init = float(telemetry_data.get("task_initiation_latency_sec", 5.0))
    n_err = float(telemetry_data.get("mistakes_count", 0))
    n_hint = float(telemetry_data.get("hints_used", 0))
    actual_sec = float(telemetry_data.get("actual_duration_sec", 60.0))
    timer_sec = float(telemetry_data.get("timer_allocated_sec", 120.0))
    focus_min = float(telemetry_data.get("focus_duration_min", 10.0))
    t_freeze = float(telemetry_data.get("post_error_freeze_sec", 0.0))
    n_rescue = float(telemetry_data.get("milo_rescues_count", 0))
    n_abandon = float(telemetry_data.get("abandoned_count", 0))

    # Observed EF Deficit
    obs_ef = (
        0.35 * max(0.0, min(1.0, (t_init - 3.0) / 20.0))
        + 0.40 * min(1.0, n_err / 3.0)
        + 0.25 * min(1.0, n_hint / 3.0)
    )
    obs_ef = max(0.0, min(1.0, obs_ef))

    # Observed Attention Decay
    time_ratio = actual_sec / max(1.0, timer_sec)
    time_factor = max(0.0, min(1.0, (time_ratio - 0.5) / 1.0))
    focus_factor = max(0.0, min(1.0, 1.0 - (focus_min / 15.0)))
    obs_as = max(0.0, min(1.0, 0.60 * time_factor + 0.40 * focus_factor))

    # Observed RSD Reactivity
    obs_rsd = (
        (min(1.0, t_freeze / 15.0) * 0.45)
        + (min(1.0, n_rescue / 2.0) * 0.35)
        + (min(1.0, n_abandon / 1.0) * 0.20)
    )
    obs_rsd = max(0.0, min(1.0, obs_rsd))

    # EMA with Max Delta Guardrail
    raw_delta_ef = alpha * (obs_ef - cur_ef)
    raw_delta_as = alpha * (obs_as - cur_as)
    raw_delta_rsd = alpha * (obs_rsd - cur_rsd)

    delta_ef = max(-max_delta, min(max_delta, raw_delta_ef))
    delta_as = max(-max_delta, min(max_delta, raw_delta_as))
    delta_rsd = max(-max_delta, min(max_delta, raw_delta_rsd))

    new_ef = round(max(0.0, min(1.0, cur_ef + delta_ef)), 4)
    new_as = round(max(0.0, min(1.0, cur_as + delta_as)), 4)
    new_rsd = round(max(0.0, min(1.0, cur_rsd + delta_rsd)), 4)
    new_cdi = round((0.40 * new_ef) + (0.35 * new_as) + (0.25 * new_rsd), 4)

    raw_span = 25.0 - (new_as * 20.0)
    attention_span_minutes = max(5, min(25, int(round(raw_span))))

    raw_micro_duration = 300.0 - (new_as * 210.0)
    recommended_duration = int(round(raw_micro_duration / 30.0) * 30)
    recommended_micro_task_duration_sec = max(60, min(300, recommended_duration))

    raw_wm = 5.0 - (new_ef * 4.0)
    working_memory_capacity = max(1, min(5, int(round(raw_wm))))

    rsd_raw_score = round(new_rsd * 9.0, 1)
    if rsd_raw_score <= 2.0:
        rsd_sensitivity_level = "LOW"
    elif rsd_raw_score <= 4.0:
        rsd_sensitivity_level = "MEDIUM"
    elif rsd_raw_score <= 7.0:
        rsd_sensitivity_level = "HIGH"
    else:
        rsd_sensitivity_level = "SEVERE"

    tier_info = resolve_scaffolding_tier(new_cdi, working_memory_capacity)
    scaffolding_tier = tier_info["scaffolding_tier"]
    scaffolding_level = tier_info["scaffolding_level"]
    target_steps = tier_info["target_step_count"]

    # Backward compatible max_steps_per_session
    if new_cdi < 0.35:
        max_steps = 6
    elif new_cdi < 0.70:
        max_steps = 4
    else:
        max_steps = 3

    verb_constraint = (
        "CHỈ được dùng ĐÚNG 1 động từ hành động duy nhất trong mỗi micro-task (ví dụ: 'Đọc', 'Gạch chân', 'Tính')."
        if working_memory_capacity <= 2
        else "Mỗi micro-task tối đa 1-2 động từ hành động liên kết trực tiếp."
    )

    rsd_tone_guideline = (
        "Áp dụng giao thức hạ nhiệt RSD tối đa: Không phê phán, không dùng từ 'sai', dùng giọng điệu ấm áp của robot Milo, tự động kích hoạt lời khen nỗ lực sau mỗi bước."
        if rsd_sensitivity_level in ["HIGH", "SEVERE"]
        else "Giọng điệu khích lệ tích cực, khen ngợi quy trình làm bài."
    )

    prompt_directives = {
        "scaffolding_tier": scaffolding_tier,
        "scaffolding_level": scaffolding_level,
        "max_atomic_steps": max_steps,
        "target_tier_step_count": target_steps,
        "step_duration_target_sec": recommended_micro_task_duration_sec,
        "cognitive_chunk_limit": working_memory_capacity,
        "verb_constraint": verb_constraint,
        "rsd_tone_guideline": rsd_tone_guideline,
        "visual_timer_interval_sec": recommended_micro_task_duration_sec,
        "tier_info": tier_info,
    }

    system_instruction_context = (
        f"HỌC SINH CÓ HỒ SƠ NHẬN THỨC CẬP NHẬT: Phân bậc {tier_info['tier_name']}. "
        f"Sức chứa trí nhớ làm việc: {working_memory_capacity} chunks. "
        f"Khoảng chú ý hữu dụng: {attention_span_minutes} phút (Micro-task {recommended_micro_task_duration_sec}s). "
        f"Độ nhạy cảm thất bại (RSD): {rsd_sensitivity_level}. Mức giàn giáo: {scaffolding_level}. "
        f"Mục tiêu phân rã: {target_steps} bước. {verb_constraint} {rsd_tone_guideline}"
    )

    cognitive_vector = {
        "attention_span_minutes": attention_span_minutes,
        "recommended_micro_task_duration_sec": recommended_micro_task_duration_sec,
        "working_memory_capacity": working_memory_capacity,
        "rsd_sensitivity_level": rsd_sensitivity_level,
        "scaffolding_level": scaffolding_level,
        "scaffolding_tier": scaffolding_tier,
        "max_steps_per_session": max_steps,
    }

    updated_profile = copy.deepcopy(current_profile)
    updated_profile.update({
        "attention_span_minutes": attention_span_minutes,
        "recommended_micro_task_duration_sec": recommended_micro_task_duration_sec,
        "working_memory_capacity": working_memory_capacity,
        "rsd_sensitivity_level": rsd_sensitivity_level,
        "scaffolding_level": scaffolding_level,
        "scaffolding_tier": scaffolding_tier,
        "scaffolding_tier_info": tier_info,
        "max_steps_per_session": max_steps,
        "prompt_injection_directives": prompt_directives,
        "normalized_indices": {
            "executive_function_deficit_index": new_ef,
            "attention_decay_index": new_as,
            "rejection_sensitivity_index": new_rsd,
            "composite_deficit_index": new_cdi,
        },
        "raw_scores": {
            "executive_function": round(new_ef * 9.0, 1),
            "attention_span": round(new_as * 9.0, 1),
            "rsd_sensitivity": round(new_rsd * 9.0, 1),
            "total_score": round((new_ef + new_as + new_rsd) * 9.0, 1),
        },
        "cognitive_profile_vector": cognitive_vector,
        "stage_2_prompt_injection_payload": {
            "system_instruction_context": system_instruction_context
        },
        "adaptive_audit_trail": {
            "alpha": alpha,
            "max_delta": max_delta,
            "observed_session": {
                "ef": round(obs_ef, 4),
                "as": round(obs_as, 4),
                "rsd": round(obs_rsd, 4),
            },
            "deltas_applied": {
                "delta_ef": round(delta_ef, 4),
                "delta_as": round(delta_as, 4),
                "delta_rsd": round(delta_rsd, 4),
            },
            "timestamp": time.time(),
        },
    })
    return updated_profile


class ScoringService:
    """Production service class for loading surveys, scoring, and generating prompt payloads."""

    def __init__(self, survey_path: Optional[Union[str, Path]] = None) -> None:
        self.survey_path = Path(survey_path) if survey_path else get_default_survey_path()
        self._survey_cache: Optional[Dict[str, Any]] = None

    def get_survey_definition(self) -> Dict[str, Any]:
        """Returns cached survey definition."""
        if self._survey_cache is None:
            self._survey_cache = load_survey_definition(self.survey_path)
        return self._survey_cache

    def score(
        self,
        answers: Union[Dict[str, Any], List[int]],
        child_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calculates cognitive profile and prompt directives."""
        return calculate_cognitive_profile(answers, child_metadata=child_metadata)

    def adaptive_update(
        self,
        current_profile: Dict[str, Any],
        telemetry_data: Dict[str, Any],
        alpha: float = 0.15,
        max_delta: float = 0.10,
    ) -> Dict[str, Any]:
        """Updates profile using telemetry observations."""
        return adaptive_update_cognitive_profile(current_profile, telemetry_data, alpha, max_delta)
