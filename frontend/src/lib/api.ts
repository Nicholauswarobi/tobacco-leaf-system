/**
 * API client — talks to the FastAPI backend.
 *
 * By default every call goes to `/backend/*` on **this same origin**, which
 * `next.config.mjs` proxies to the FastAPI server. That indirection is what
 * makes the app work from a phone.
 *
 * Calling `http://localhost:8000` directly only ever works on the machine
 * running the backend. Open the site from a phone — over ngrok, a tunnel, or
 * the LAN — and `localhost` means *the phone*, so the request goes nowhere.
 * Worse, a page served over https cannot call an http address at all: the
 * browser blocks it as mixed content before a packet is sent. Both failures
 * surface identically, as a fetch that simply rejects.
 *
 * Going through the same origin sidesteps all of it — no second tunnel, no
 * mixed content, and no CORS, since the browser sees only one origin.
 *
 * Set NEXT_PUBLIC_API_URL to an absolute URL to bypass the proxy and call a
 * backend directly (the split-deployment case: frontend on Vercel, backend
 * elsewhere). It must be an address the *browser* can reach, and it must be
 * https if the page is.
 */
import type {
  PredictionResponse,
  HistoryResponse,
  HistoryItem,
  VerificationResponse,
  VerificationResult,
} from "@/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/backend").replace(
  /\/+$/,
  ""
);

/** Backend code for a Tobacco Verification rejection. */
export const NOT_A_TOBACCO_LEAF = "NOT_A_TOBACCO_LEAF";

/** Backend code for a real tobacco leaf sent to the wrong analysis. */
export const WRONG_SECTION = "WRONG_SECTION";

export interface RoutingHint {
  is_tobacco: boolean;
  detected_state: "fresh" | "cured" | "unknown";
  attempted_mode: "disease" | "quality";
  suggested_mode: "disease" | "quality";
  evidence?: Record<string, unknown>;
}

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

/**
 * Thrown when a genuine tobacco leaf was uploaded to the wrong analysis.
 *
 * Deliberately not a NotATobaccoLeafError: the image *is* tobacco, and telling
 * someone otherwise when they merely opened the wrong tab is both wrong and
 * infuriating. The UI should offer to move them to `suggestedMode`.
 */
export class WrongSectionError extends Error {
  readonly routing: RoutingHint;

  constructor(message: string, routing: RoutingHint) {
    super(message);
    this.name = "WrongSectionError";
    this.routing = routing;
  }

  get suggestedMode(): "disease" | "quality" {
    return this.routing.suggested_mode;
  }
}

/** Progress of the photo travelling to the server, 0–1. */
export type UploadProgress = (fraction: number) => void;

/**
 * POST a file and report real upload progress.
 *
 * `fetch` cannot report how much of a request body has been sent, and on a
 * phone over mobile data the upload is the slow part — several seconds for a
 * 3 MB photo. XMLHttpRequest is the only API that exposes it, so it is used
 * here rather than showing a spinner that tells the user nothing.
 *
 * The response is converted back into a `Response` so callers keep using the
 * same `handle()` path as every other request.
 */
function postFile(
  url: string,
  file: File,
  onProgress?: UploadProgress
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "text";

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        // Without Content-Length there is nothing honest to report, so the
        // caller is left on its indeterminate state instead of being fed a
        // made-up number.
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.min(1, e.loaded / e.total));
        }
      });
      xhr.upload.addEventListener("load", () => onProgress(1));
    }

    xhr.addEventListener("load", () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    xhr.addEventListener("error", () =>
      reject(new TypeError("Network request failed"))
    );
    xhr.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError"))
    );
    xhr.addEventListener("timeout", () =>
      reject(new TypeError("Network request timed out"))
    );

    xhr.send(fd);
  });
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || body.detail || message;
      // FastAPI request-validation failures arrive as a bare "Validation
      // error" with the real cause buried in `details`. Folding the first one
      // into the message is the difference between a developer seeing
      // "Validation error" and seeing "body.file: Field required".
      if (Array.isArray(body.details) && body.details.length > 0) {
        const first = body.details[0];
        const where = Array.isArray(first?.loc) ? first.loc.join(".") : "";
        message = [message, [where, first?.msg].filter(Boolean).join(": ")]
          .filter(Boolean)
          .join(" — ");
      }
      if (body.code === NOT_A_TOBACCO_LEAF) {
        throw new NotATobaccoLeafError(message, body.verification);
      }
      if (body.code === WRONG_SECTION && body.routing) {
        throw new WrongSectionError(message, body.routing as RoutingHint);
      }
    } catch (e) {
      if (e instanceof NotATobaccoLeafError) throw e;
      if (e instanceof WrongSectionError) throw e;
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

  async predictDisease(
    file: File,
    onProgress?: UploadProgress
  ): Promise<PredictionResponse> {
    const res = await postFile(
      `${API_BASE}/api/predict/disease`,
      file,
      onProgress
    );
    return handle(res);
  },

  async predictQuality(
    file: File,
    onProgress?: UploadProgress
  ): Promise<PredictionResponse> {
    const res = await postFile(
      `${API_BASE}/api/predict/quality`,
      file,
      onProgress
    );
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
