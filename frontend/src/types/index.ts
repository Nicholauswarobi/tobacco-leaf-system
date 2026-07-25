export interface ClassProbability {
  label: string;
  probability: number;
}

/** Which tier of the verification gate produced a verdict. */
export type VerificationMethod =
  | "verification_model"
  | "color_prescreen"
  | "disabled";

/**
 * Verdict from the Tobacco Verification Model, which runs before disease
 * detection and quality grading.
 */
export interface VerificationResult {
  is_tobacco: boolean;
  label: string;
  confidence: number;
  message: string;
  method: VerificationMethod;
  threshold: number;
  all_probabilities: ClassProbability[];
  detail?: string | null;
}

export interface VerificationResponse {
  verification: VerificationResult;
  image_url?: string | null;
  processing_time_ms: number;
}

export interface DiseaseResult {
  label: string;
  confidence: number;
  description: string;
  recommendations: string[];
  all_probabilities: ClassProbability[];
}

export interface QualityResult {
  grade: string;
  confidence: number;
  description: string;
  market_value: string;
  all_probabilities: ClassProbability[];
}

export interface PredictionResponse {
  id: string;
  timestamp: string;
  image_url?: string | null;
  /** "disease" = disease-only, "quality" = quality-only, "full" = both */
  mode: "disease" | "quality" | "full";
  /** Always present on new responses; optional for history saved before the gate existed. */
  verification?: VerificationResult | null;
  disease: DiseaseResult;
  quality: QualityResult;
  processing_time_ms: number;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  image_url?: string | null;
  /** "disease" = disease-only, "quality" = quality-only, "full" = both */
  mode: "disease" | "quality" | "full";
  disease_label: string;
  disease_confidence: number;
  quality_grade: string;
  quality_confidence: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
}

export interface ApiError {
  error: boolean;
  message: string;
  status?: number;
  code?: string;
  verification?: VerificationResult;
}
