/**
 * API client — talks to the FastAPI backend.
 *
 * The base URL is read from NEXT_PUBLIC_API_URL at build time.
 * Falls back to the dev default localhost:8000.
 */
import type {
  PredictionResponse,
  HistoryResponse,
  HistoryItem,
  VerificationResponse,
  VerificationResult,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Backend code for a Tobacco Verification rejection. */
export const NOT_A_TOBACCO_LEAF = "NOT_A_TOBACCO_LEAF";

/**
 * Thrown when the Tobacco Verification Model rejects an upload.
 *
 * A distinct type because this is not a failure — the system worked correctly
 * and the image simply is not a tobacco leaf. The UI should say so calmly
 * rather than showing a red error.
 */
export class NotATobaccoLeafError extends Error {
  readonly verification?: VerificationResult;

  constructor(message: string, verification?: VerificationResult) {
    super(message);
    this.name = "NotATobaccoLeafError";
    this.verification = verification;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || body.detail || message;
      if (body.code === NOT_A_TOBACCO_LEAF) {
        throw new NotATobaccoLeafError(message, body.verification);
      }
    } catch (e) {
      if (e instanceof NotATobaccoLeafError) throw e;
      /* non-JSON error body — fall through to the generic error */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE,

  // Resolve a backend-relative image path to an absolute URL we can <img/> from.
  asset(path?: string | null): string {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${API_BASE}${path}`;
  },

  async health(): Promise<{
    status: string;
    version: string;
    model_loaded: boolean;
    quality_model_loaded: boolean;
    verification_model_loaded: boolean;
    verification_method: string;
    verification_threshold: number;
    uptime_seconds: number;
  }> {
    const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
    return handle(res);
  },

  async classes(): Promise<{
    diseases: string[];
    qualities: string[];
    verification: string[];
  }> {
    const res = await fetch(`${API_BASE}/api/classes`, { cache: "no-store" });
    return handle(res);
  },

  /**
   * Run the Tobacco Verification Model on its own, without predicting.
   * Throws NotATobaccoLeafError when the image is rejected.
   */
  async verify(file: File): Promise<VerificationResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/verify`, {
      method: "POST",
      body: fd,
    });
    return handle(res);
  },

  async predict(file: File): Promise<PredictionResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: "POST",
      body: fd,
    });
    return handle(res);
  },

  async predictDisease(file: File): Promise<PredictionResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/predict/disease`, {
      method: "POST",
      body: fd,
    });
    return handle(res);
  },

  async predictQuality(file: File): Promise<PredictionResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/predict/quality`, {
      method: "POST",
      body: fd,
    });
    return handle(res);
  },

  async history(limit = 50): Promise<HistoryResponse> {
    const res = await fetch(`${API_BASE}/api/history?limit=${limit}`, {
      cache: "no-store",
    });
    return handle(res);
  },

  async deleteHistory(id: string): Promise<{ deleted: string }> {
    const res = await fetch(`${API_BASE}/api/history/${id}`, {
      method: "DELETE",
    });
    return handle(res);
  },

  exportCsvUrl(): string {
    return `${API_BASE}/api/history/export/csv`;
  },

  async adminStats(apiKey: string): Promise<{
    total: number;
    by_disease: Record<string, number>;
    by_grade: Record<string, number>;
  }> {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    return handle(res);
  },
};

export type Api = typeof api;
