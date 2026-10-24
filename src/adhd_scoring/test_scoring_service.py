"""
Unit tests for ADHD parent survey schema and scoring service.
Tests validation, boundary conditions (all 0s, all 3s, mixed),
input formats, and interface contract compliance.
"""

import json
import unittest
from pathlib import Path

from src.adhd_scoring.scoring_service import (
    calculate_cognitive_profile,
    get_default_survey_path,
    load_survey_definition,
    validate_survey_answers,
    resolve_scaffolding_tier,
    adaptive_update_cognitive_profile,
    ScoringService,
)


class TestADHDParentSurveyJSON(unittest.TestCase):
    """Verifies data/surveys/adhd_parent_survey.json schema, questions, and metadata."""

    def setUp(self):
        self.survey_path = get_default_survey_path()

    def test_file_exists_and_is_valid_json(self):
        self.assertTrue(self.survey_path.is_file(), f"Survey file does not exist at {self.survey_path}")
        with open(self.survey_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIsInstance(data, dict)
        self.assertEqual(data.get("survey_id"), "adhd_vadprs_snapiv_9q")
        self.assertEqual(data.get("version"), "1.0.0")

    def test_contains_exactly_9_questions(self):
        data = load_survey_definition(self.survey_path)
        questions = data.get("questions", [])
        self.assertEqual(len(questions), 9, f"Expected 9 questions, found {len(questions)}")

        expected_ids = [f"q{i}" for i in range(1, 10)]
        actual_ids = [q["id"] for q in questions]
        self.assertEqual(actual_ids, expected_ids)

    def test_clinical_dimensions_coverage(self):
        data = load_survey_definition(self.survey_path)
        questions = data.get("questions", [])

        dim_map = {q["id"]: q["dimension"] for q in questions}
        # q1-q3: Executive Function
        for qid in ["q1", "q2", "q3"]:
            self.assertEqual(dim_map[qid], "executive_function")
        # q4-q6: Attention Span
        for qid in ["q4", "q5", "q6"]:
            self.assertEqual(dim_map[qid], "attention_span")
        # q7-q9: RSD
        for qid in ["q7", "q8", "q9"]:
            self.assertEqual(dim_map[qid], "rsd_sensitivity")

        for q in questions:
            self.assertIn("clinical_source", q)
            self.assertIn("prompt_text", q)
            self.assertIn("behavioral_anchor", q)
            self.assertIn("cognitive_impact", q)
            self.assertTrue(len(q["prompt_text"]) > 10)

    def test_likert_scale_definition(self):
        data = load_survey_definition(self.survey_path)
        scale = data.get("scoring_scale", [])
        self.assertEqual(len(scale), 4)
        scale_values = [item["value"] for item in scale]
        self.assertEqual(scale_values, [0, 1, 2, 3])

    def test_scoring_formulas_and_mapping_present(self):
        data = load_survey_definition(self.survey_path)
        self.assertIn("scoring_formulas_and_mapping", data)
        mapping = data["scoring_formulas_and_mapping"]
        self.assertIn("raw_subscale_scores", mapping)
        self.assertIn("normalized_indices", mapping)
        self.assertIn("cognitive_profile_vector_mapping", mapping)
        self.assertIn("prompt_injection_directives", mapping)


class TestScoringServiceBoundaryCases(unittest.TestCase):
    """Verifies scoring engine on all boundary conditions and typical profiles."""

    def test_boundary_all_zeros_neurotypical_baseline(self):
        answers = {f"q{i}": 0 for i in range(1, 10)}
        profile = calculate_cognitive_profile(answers)

        # Raw & Indices
        self.assertEqual(profile["raw_scores"]["executive_function"], 0)
        self.assertEqual(profile["raw_scores"]["attention_span"], 0)
        self.assertEqual(profile["raw_scores"]["rsd_sensitivity"], 0)
        self.assertEqual(profile["raw_scores"]["total_score"], 0)
        self.assertEqual(profile["normalized_indices"]["composite_deficit_index"], 0.0)

        # Cognitive Profile Vector
        self.assertEqual(profile["attention_span_minutes"], 25)
        self.assertEqual(profile["recommended_micro_task_duration_sec"], 300)
        self.assertEqual(profile["working_memory_capacity"], 5)
        self.assertEqual(profile["rsd_sensitivity_level"], "LOW")
        self.assertEqual(profile["scaffolding_level"], "MINIMAL")
        self.assertEqual(profile["max_steps_per_session"], 6)

        # Prompt Directives
        directives = profile["prompt_injection_directives"]
        self.assertEqual(directives["max_atomic_steps"], 6)
        self.assertEqual(directives["step_duration_target_sec"], 300)
        self.assertEqual(directives["cognitive_chunk_limit"], 5)
        self.assertIn("1-2 động từ", directives["verb_constraint"])
        self.assertIn("Giọng điệu khích lệ tích cực", directives["rsd_tone_guideline"])

    def test_boundary_all_threes_severe_adhd_and_rsd(self):
        answers = {f"q{i}": 3 for i in range(1, 10)}
        profile = calculate_cognitive_profile(answers)

        # Raw & Indices
        self.assertEqual(profile["raw_scores"]["executive_function"], 9)
        self.assertEqual(profile["raw_scores"]["attention_span"], 9)
        self.assertEqual(profile["raw_scores"]["rsd_sensitivity"], 9)
        self.assertEqual(profile["raw_scores"]["total_score"], 27)
        self.assertEqual(profile["normalized_indices"]["composite_deficit_index"], 1.0)

        # Cognitive Profile Vector
        self.assertEqual(profile["attention_span_minutes"], 5)
        self.assertEqual(profile["recommended_micro_task_duration_sec"], 90)
        self.assertEqual(profile["working_memory_capacity"], 1)
        self.assertEqual(profile["rsd_sensitivity_level"], "SEVERE")
        self.assertEqual(profile["scaffolding_level"], "INTENSIVE")
        self.assertEqual(profile["max_steps_per_session"], 3)

        # Prompt Directives
        directives = profile["prompt_injection_directives"]
        self.assertEqual(directives["max_atomic_steps"], 3)
        self.assertEqual(directives["step_duration_target_sec"], 90)
        self.assertEqual(directives["cognitive_chunk_limit"], 1)
        self.assertIn("ĐÚNG 1 động từ", directives["verb_constraint"])
        self.assertIn("giao thức hạ nhiệt RSD tối đa", directives["rsd_tone_guideline"])

    def test_boundary_all_twos_moderate_adhd(self):
        answers = {f"q{i}": 2 for i in range(1, 10)}
        profile = calculate_cognitive_profile(answers)

        # Raw & Indices
        self.assertEqual(profile["raw_scores"]["executive_function"], 6)
        self.assertEqual(profile["raw_scores"]["attention_span"], 6)
        self.assertEqual(profile["raw_scores"]["rsd_sensitivity"], 6)
        self.assertEqual(profile["raw_scores"]["total_score"], 18)
        self.assertEqual(profile["normalized_indices"]["composite_deficit_index"], 0.6667)

        # Vectors
        self.assertEqual(profile["attention_span_minutes"], 12)
        self.assertEqual(profile["recommended_micro_task_duration_sec"], 150)
        self.assertEqual(profile["working_memory_capacity"], 2)
        self.assertEqual(profile["rsd_sensitivity_level"], "HIGH")
        self.assertEqual(profile["scaffolding_level"], "MODERATE")
        self.assertEqual(profile["max_steps_per_session"], 4)

    def test_mixed_severe_rsd_and_ef_mild_attention(self):
        # EF=8 (q1=3, q2=3, q3=2), AS=3 (q4=1, q5=1, q6=1), RSD=8 (q7=3, q8=3, q9=2)
        answers = {"q1": 3, "q2": 3, "q3": 2, "q4": 1, "q5": 1, "q6": 1, "q7": 3, "q8": 3, "q9": 2}
        profile = calculate_cognitive_profile(answers)

        self.assertEqual(profile["raw_scores"]["executive_function"], 8)
        self.assertEqual(profile["raw_scores"]["attention_span"], 3)
        self.assertEqual(profile["raw_scores"]["rsd_sensitivity"], 8)
        self.assertEqual(profile["rsd_sensitivity_level"], "SEVERE")
        self.assertEqual(profile["working_memory_capacity"], 1)
        self.assertEqual(profile["attention_span_minutes"], 18)
        self.assertEqual(profile["recommended_micro_task_duration_sec"], 240)

    def test_mixed_severe_inattention_low_rsd(self):
        # EF=4, AS=9 (q4=3, q5=3, q6=3), RSD=1 (q7=0, q8=0, q9=1)
        answers = {"q1": 2, "q2": 1, "q3": 1, "q4": 3, "q5": 3, "q6": 3, "q7": 0, "q8": 0, "q9": 1}
        profile = calculate_cognitive_profile(answers)

        self.assertEqual(profile["raw_scores"]["attention_span"], 9)
        self.assertEqual(profile["raw_scores"]["rsd_sensitivity"], 1)
        self.assertEqual(profile["attention_span_minutes"], 5)
        self.assertEqual(profile["recommended_micro_task_duration_sec"], 90)
        self.assertEqual(profile["rsd_sensitivity_level"], "LOW")


class TestScoringServiceInputFormatsAndValidation(unittest.TestCase):
    """Verifies answer format adaptability and validation error handling."""

    def test_accepts_list_of_nine_integers(self):
        answers = [1, 2, 1, 0, 1, 2, 3, 2, 1]
        profile = calculate_cognitive_profile(answers)
        self.assertEqual(profile["raw_scores"]["total_score"], sum(answers))

    def test_accepts_dict_with_integer_keys(self):
        answers = {i: 1 for i in range(1, 10)}
        profile = calculate_cognitive_profile(answers)
        self.assertEqual(profile["raw_scores"]["total_score"], 9)

    def test_accepts_dict_with_string_number_keys(self):
        answers = {str(i): 2 for i in range(1, 10)}
        profile = calculate_cognitive_profile(answers)
        self.assertEqual(profile["raw_scores"]["total_score"], 18)

    def test_accepts_integer_floats(self):
        answers = {f"q{i}": 2.0 for i in range(1, 10)}
        profile = calculate_cognitive_profile(answers)
        self.assertEqual(profile["raw_scores"]["total_score"], 18)

    def test_rejects_missing_question(self):
        answers = {f"q{i}": 1 for i in range(1, 9)}  # missing q9
        with self.assertRaises(ValueError):
            calculate_cognitive_profile(answers)

    def test_rejects_wrong_list_length(self):
        with self.assertRaises(ValueError):
            calculate_cognitive_profile([1, 2, 3])

    def test_rejects_out_of_range_scores(self):
        with self.assertRaises(ValueError):
            calculate_cognitive_profile({"q1": 4, **{f"q{i}": 1 for i in range(2, 10)}})
        with self.assertRaises(ValueError):
            calculate_cognitive_profile({"q1": -1, **{f"q{i}": 1 for i in range(2, 10)}})

    def test_rejects_non_integer_floats(self):
        with self.assertRaises(ValueError):
            calculate_cognitive_profile({"q1": 1.5, **{f"q{i}": 1 for i in range(2, 10)}})

    def test_rejects_booleans(self):
        with self.assertRaises(ValueError):
            calculate_cognitive_profile({"q1": True, **{f"q{i}": 1 for i in range(2, 10)}})

    def test_rejects_invalid_types(self):
        with self.assertRaises(TypeError):
            calculate_cognitive_profile("invalid_string_input")  # type: ignore


class TestScoringServiceClassAndInterfaceContract(unittest.TestCase):
    """Verifies ScoringService class and compliance with PROJECT.md contract."""

    def test_scoring_service_instance_methods(self):
        service = ScoringService()
        survey_def = service.get_survey_definition()
        self.assertIn("questions", survey_def)

        result = service.score([0] * 9)
        self.assertEqual(result["scaffolding_level"], "MINIMAL")

    def test_interface_contract_top_level_keys(self):
        profile = calculate_cognitive_profile([2] * 9)
        required_contract_keys = [
            "attention_span_minutes",
            "recommended_micro_task_duration_sec",
            "working_memory_capacity",
            "rsd_sensitivity_level",
            "scaffolding_level",
            "max_steps_per_session",
            "prompt_injection_directives",
        ]
        for key in required_contract_keys:
            self.assertIn(key, profile, f"Missing interface contract key: {key}")

        directives = profile["prompt_injection_directives"]
        directive_keys = [
            "scaffolding_level",
            "max_atomic_steps",
            "step_duration_target_sec",
            "cognitive_chunk_limit",
            "verb_constraint",
            "rsd_tone_guideline",
        ]
        for key in directive_keys:
            self.assertIn(key, directives, f"Missing directive key: {key}")


class TestAdaptiveCognitiveUpdating(unittest.TestCase):
    """Verifies real-time dynamic cognitive profile updates and 5-tier scaffolding spectrum."""

    def test_5_tier_resolution(self):
        t1 = resolve_scaffolding_tier(0.85, 1)
        self.assertEqual(t1["scaffolding_tier"], "TIER_1_ULTRA_ATOMIC")
        self.assertEqual(t1["target_step_count"], 5)

        t2 = resolve_scaffolding_tier(0.60, 2)
        self.assertEqual(t2["scaffolding_tier"], "TIER_2_HIGH_SCAFFOLD")
        self.assertEqual(t2["target_step_count"], 4)

        t3 = resolve_scaffolding_tier(0.45, 3)
        self.assertEqual(t3["scaffolding_tier"], "TIER_3_BALANCED")
        self.assertEqual(t3["target_step_count"], 3)

        t4 = resolve_scaffolding_tier(0.28, 4)
        self.assertEqual(t4["scaffolding_tier"], "TIER_4_GUIDED")
        self.assertEqual(t4["target_step_count"], 2)

        t5 = resolve_scaffolding_tier(0.12, 5)
        self.assertEqual(t5["scaffolding_tier"], "TIER_5_MASTERY")
        self.assertEqual(t5["target_step_count"], 1)

    def test_adaptive_update_improving_child(self):
        # Initial baseline: Moderate ADHD (CDI around 0.66)
        baseline = calculate_cognitive_profile([2] * 9)
        self.assertEqual(baseline["scaffolding_tier"], "TIER_2_HIGH_SCAFFOLD")

        # Telemetry: Fast initiation (3s), 0 mistakes, 0 hints, fast completion (40s/120s), continuous focus
        telemetry = {
            "task_initiation_latency_sec": 3.0,
            "mistakes_count": 0,
            "hints_used": 0,
            "actual_duration_sec": 40.0,
            "timer_allocated_sec": 120.0,
            "focus_duration_min": 15.0,
            "post_error_freeze_sec": 0.0,
            "milo_rescues_count": 0,
            "abandoned_count": 0,
        }
        updated = adaptive_update_cognitive_profile(baseline, telemetry, alpha=0.30, max_delta=0.20)

        # Deficits should reduce, composite deficit index should decrease
        self.assertLess(
            updated["normalized_indices"]["composite_deficit_index"],
            baseline["normalized_indices"]["composite_deficit_index"]
        )
        self.assertIn("adaptive_audit_trail", updated)

    def test_adaptive_update_struggling_child(self):
        # Initial baseline: Mild/Balanced (CDI around 0.33)
        baseline = calculate_cognitive_profile([1] * 9)

        # Telemetry: High latency, 3 mistakes, 3 hints, post-error freeze, rescue called
        telemetry = {
            "task_initiation_latency_sec": 25.0,
            "mistakes_count": 3,
            "hints_used": 3,
            "actual_duration_sec": 150.0,
            "timer_allocated_sec": 120.0,
            "focus_duration_min": 3.0,
            "post_error_freeze_sec": 20.0,
            "milo_rescues_count": 2,
            "abandoned_count": 1,
        }
        updated = adaptive_update_cognitive_profile(baseline, telemetry, alpha=0.30, max_delta=0.20)

        # Deficits should increase
        self.assertGreater(
            updated["normalized_indices"]["composite_deficit_index"],
            baseline["normalized_indices"]["composite_deficit_index"]
        )

    def test_max_delta_guardrail_bounding(self):
        baseline = calculate_cognitive_profile([2] * 9)
        # Extreme telemetry with high alpha, but max_delta is 0.08
        telemetry = {
            "task_initiation_latency_sec": 1.0,
            "mistakes_count": 0,
            "hints_used": 0,
            "actual_duration_sec": 10.0,
            "timer_allocated_sec": 120.0,
            "focus_duration_min": 30.0,
            "post_error_freeze_sec": 0.0,
            "milo_rescues_count": 0,
            "abandoned_count": 0,
        }
        updated = adaptive_update_cognitive_profile(baseline, telemetry, alpha=1.0, max_delta=0.08)
        old_cdi = baseline["normalized_indices"]["composite_deficit_index"]
        new_cdi = updated["normalized_indices"]["composite_deficit_index"]
        self.assertLessEqual(abs(old_cdi - new_cdi), 0.09)


if __name__ == "__main__":
    unittest.main()
