import type { WidgetConfig } from "./config";
import type { DetailsData, CapturedImage } from "./flow/state";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface SessionResponse {
  sessionId: string;
}
interface SubmitResponse {
  reference: string;
}

export async function createSession(config: WidgetConfig): Promise<string> {
  const response = await request<SessionResponse>(config, "/sessions", { method: "POST" });
  return response.sessionId;
}

export async function uploadDocument(
  config: WidgetConfig,
  sessionId: string,
  kind: "id_front" | "selfie",
  image: CapturedImage,
): Promise<void> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", image.blob, `${kind}.jpg`);
  await request(config, `/sessions/${encodeURIComponent(sessionId)}/documents`, {
    method: "POST",
    body: form,
  });
}

export async function submitSession(
  config: WidgetConfig,
  sessionId: string,
  details: DetailsData,
): Promise<string> {
  const response = await request<SubmitResponse>(config, `/sessions/${encodeURIComponent(sessionId)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  });
  return response.reference;
}

async function request<T = unknown>(config: WidgetConfig, path: string, init: RequestInit): Promise<T> {
  const base = config.api.baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "X-Public-Key": config.api.publicKey, ...init.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const payload = await response.json() as { detail?: unknown; error?: { message?: unknown } };
      const detail = payload.detail ?? payload.error?.message;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail)) message = detail.map((item) => typeof item === "object" && item !== null && "msg" in item ? String(item.msg) : String(item)).join("; ");
    } catch {
      message = `Request failed (${response.status}).`;
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
