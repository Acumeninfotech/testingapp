export interface University {
  id: string;
  university_name: string;
  course_code: string;
  course_name: string;
  entry_route: string;
  country: string;
  fee_status: string[];
  entry_year: number;
  intake_month?: string | null;
  uses_ucat?: boolean;
  assessment_mode?: string;
  interview_prediction_available?: boolean;
  institution_funding_type?: string | null;
  location?: string | null;
  duration_years?: number | null;
  home_places?: number | null;
  international_places?: number | null;
  places_approximate?: boolean;
}

export interface UniversitiesResponse {
  universities: University[];
  count: number;
}

// studentProfile is passed through to the existing engine unmodified; the
// frontend does not interpret or validate its internal shape.
export interface StudentProfile {
  [key: string]: unknown;
}

export interface PredictRequest {
  universityIds: string[];
  studentProfile: StudentProfile;
}

export interface DecisionPathCheck {
  label: string;
  status: string;
  summary: string;
}

export interface DecisionPathStage {
  stage: string;
  status: string;
  summary: string;
  checks: DecisionPathCheck[];
}

export interface ScoreBreakdown {
  name: string;
  value: number | null;
  max: number | null;
  applicable_max_score?: number | null;
  selection_score_max?: number | null;
  global_max?: number | null;
  // 'unavailable' means this university does publish a combined score, but
  // one or more inputs are missing for this applicant - distinct from a
  // ranking-only university (no score_breakdown at all) and from a
  // successfully calculated score.
  status: string;
  explanation?: string | null;
  reason?: string | null;
  unofficial?: boolean;
  checks: DecisionPathCheck[];
}

export interface UcatComparison {
  comparison_type:
    | 'official_minimum'
    | 'historical_threshold'
    | 'historical_range'
    | 'historical_average'
    | 'current_guidance'
    | 'ranking_only';
  applicant_ucat: number | null;
  benchmark_min: number | null;
  benchmark_max: number | null;
  benchmark_label?: string | null;
  caveat?: string | null;
  difference_from_benchmark: number | null;
  position: 'above' | 'within' | 'below' | null;
  applicant_pool: string | null;
  sjt_policy: string;
  sjt_outcome: 'met' | 'not_met' | 'ignored' | 'scored' | 'post_interview';
  sjt_summary: string;
  applicant_sjt_band: number | null;
  official_ucat_minimum?: {
    minimum: number;
    met: boolean;
    summary: string;
  } | null;
}

export interface SelectionMetric {
  type: 'ucat' | 'selection_score' | 'points' | 'eligibility';
  label: string;
  applicant_value: number | null;
  comparison_value: number | null;
  comparison_max_value: number | null;
  comparison_label: string | null;
  comparison_label_type:
    | 'published_ucat_minimum'
    | 'published_interview_threshold'
    | 'historical_interview_guide'
    | 'recent_interview_benchmark'
    | 'applysmart_advisory_guide'
    | null;
  comparison_context: string | null;
  difference: number | null;
  difference_direction: 'above' | 'below' | 'at' | null;
  difference_word: string | null;
  maximum_value: number | null;
  display_mode: 'comparison' | 'score' | 'eligibility';
  display_eligibility: boolean;
  entry_year?: number | string | null;
  value_label?: string | null;
  caveat?: string | null;
}

export interface CompactStatus {
  label: string;
  type:
    | 'selection_comparison'
    | 'selection_metric'
    | 'eligibility'
    | 'manual_review'
    | 'information_needed'
    | 'prediction_unavailable';
  tone: 'positive' | 'neutral' | 'warning' | 'negative';
}

export interface ComparisonMetric {
  label: string;
  value: string;
  difference?: string | null;
}

export interface DecisionTransparency {
  decision_path?: DecisionPathStage[];
  key_reasons?: string[];
  evidence_used?: string[];
  warnings?: string[];
  manual_review_reason?: string | null;
  insufficient_evidence_reason?: string | null;
  // Distinguishes an insufficient_evidence result caused by the university's
  // own methodology having a gap ApplySmart can't execute for this
  // applicant's route ('university_methodology_gap') from a generic
  // evidence gap. Null/absent for older universities and other display
  // states.
  insufficient_evidence_reason_code?:
    | 'university_methodology_gap'
    | 'applicant_evidence_gap'
    | 'missing_birmingham_english_language_grade'
    | 'missing_birmingham_english_literature_grade'
    | 'missing_birmingham_mathematics_grade'
    | 'missing_birmingham_biology_grade'
    | 'missing_birmingham_chemistry_grade'
    | 'missing_birmingham_additional_gcse_scoring_grades'
    | null;
  score_breakdown?: ScoreBreakdown | null;
  ucat_comparison?: UcatComparison | null;
  selection_metric?: SelectionMetric | null;
  compact_status?: CompactStatus | null;
  comparison_metrics_title?: string | null;
  comparison_metrics?: ComparisonMetric[];
  [key: string]: unknown;
}

export interface ResultCard {
  primary_user_facing_recommendation: string;
  recommendation_display_state: string;
  primary_explanation: string;
  trust_statement?: string | null;
  historical_guidance_caveat?: string | null;
  // Set to 'guaranteed_interview' when every published guaranteed-interview
  // condition for this applicant's route has been verified as met (e.g.
  // Birmingham UKWPMED) - categorically different from a scored/ranked
  // recommendation.
  interview_outcome?: string | null;
  prediction: {
    result_band: string;
    [key: string]: unknown;
  };
  eligibility?: {
    status?: string;
    stage_1_checks?: unknown[];
    blocking_reasons?: string[];
    [key: string]: unknown;
  };
  evidence_confidence?: {
    level?: string;
    summary?: string;
    reasons?: string[];
    [key: string]: unknown;
  };
  decision_transparency?: DecisionTransparency;
  decision_timeline?: { step: number; title: string; status: string; summary: string }[];
  [key: string]: unknown;
}

export interface PredictionResult {
  universityId: string;
  university: string;
  result_card: ResultCard;
}

export interface PredictResponse {
  results: PredictionResult[];
}
