import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsEmitter } from "../src/analytics";
import { copyConfig } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("analytics batching", () => {
  it("sends privacy-minimal batches with sendBeacon", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      userAgent: "Synthetic Test Browser",
      sendBeacon,
    });
    const onEvent = vi.fn();
    const emitter = new AnalyticsEmitter(copyConfig(), onEvent);
    for (let index = 0; index < 8; index += 1)
      emitter.emit("step_viewed", "details");
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(sendBeacon.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/events");
    expect(sendBeacon.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
    expect(onEvent).toHaveBeenCalledTimes(8);
    const event = onEvent.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      type: "step_viewed",
      step: "details",
      locale: "en",
    });
    expect(event).not.toHaveProperty("fullName");
    emitter.destroy();
  });

  it("does not transmit when analytics are disabled", () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal("navigator", {
      userAgent: "Synthetic Test Browser",
      sendBeacon,
    });
    const config = copyConfig();
    config.analytics.enabled = false;
    const emitter = new AnalyticsEmitter(config);
    emitter.emit("step_viewed", "details");
    emitter.destroy();
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
