import type { WidgetConfig } from "./config";
import type { StepId } from "./config";
import type { WidgetEvent } from "./index";

export type WidgetEventType =
  | "step_viewed"
  | "step_completed"
  | "step_failed"
  | "camera_permission_denied"
  | "upload_fallback_used"
  | "submit_started"
  | "submit_succeeded"
  | "submit_failed";

export class AnalyticsEmitter {
  private config: WidgetConfig;
  private readonly sessionId = createSessionId();
  private readonly queue: WidgetEvent[] = [];
  private readonly pageHideHandler = () => this.flush();

  constructor(config: WidgetConfig, private readonly onEvent?: (event: WidgetEvent) => void) {
    this.config = config;
    window.addEventListener("pagehide", this.pageHideHandler);
  }

  updateConfig(config: WidgetConfig) {
    this.config = config;
  }

  emit(type: WidgetEventType, step: StepId, reason?: string) {
    const event: WidgetEvent = {
      type,
      sessionId: this.sessionId,
      step,
      timestamp: new Date().toISOString(),
      locale: this.config.locale,
      deviceClass: getDeviceClass(),
      ...(reason ? { reason } : {}),
    };
    try {
      this.onEvent?.(event);
    } catch {
      // Event delivery to the host does not control network batching.
    }
    if (!this.config.analytics.enabled) return;
    this.queue.push(event);
    if (this.queue.length >= 8) this.flush();
  }

  destroy() {
    window.removeEventListener("pagehide", this.pageHideHandler);
    this.flush();
  }

  private flush() {
    if (!this.queue.length) return;
    const events = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify({ events });
    const url = `${this.config.api.baseUrl.replace(/\/+$/, "")}/events`;
    try {
      if (typeof navigator.sendBeacon === "function") {
        const accepted = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        if (accepted) return;
      }
    } catch {
      // The keepalive request below handles browsers that reject sendBeacon.
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Public-Key": this.config.api.publicKey },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getDeviceClass(): WidgetEvent["deviceClass"] {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Android/i.test(agent)) return "android";
  return "desktop";
}
