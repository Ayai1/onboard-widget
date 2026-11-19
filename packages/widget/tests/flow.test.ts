import { describe, expect, it } from "vitest";
import { configSchema } from "../src/config";
import {
  createInitialFlowState,
  flowReducer,
  validateDetails,
} from "../src/flow/state";
import { copyConfig } from "./fixtures";

describe("flow state", () => {
  it("moves between configured steps and preserves details", () => {
    const initial = createInitialFlowState(["details", "selfie", "review"]);
    const withDetails = flowReducer(initial, {
      type: "set_details",
      details: {
        fullName: "Sample Person",
        dateOfBirth: "1990-01-02",
        country: "IN",
        email: "sample@example.test",
      },
    });
    const next = flowReducer(withDetails, { type: "navigate", step: "selfie" });
    expect(next.currentStep).toBe("selfie");
    expect(next.details.fullName).toBe("Sample Person");
    expect(flowReducer(next, { type: "navigate", step: "id_capture" })).toBe(
      next,
    );
  });

  it("records valid, failed, and submission transitions", () => {
    let state = createInitialFlowState(["details", "review"]);
    state = flowReducer(state, {
      type: "step_failed",
      step: "details",
      errors: { email: "invalidEmail" },
    });
    expect(state.status.details).toBe("failed");
    state = flowReducer(state, { type: "step_valid", step: "details" });
    expect(state.status.details).toBe("valid");
    state = flowReducer(state, { type: "submit_started" });
    state = flowReducer(state, {
      type: "session_created",
      sessionId: "sample-session",
    });
    state = flowReducer(state, {
      type: "submit_succeeded",
      reference: "ONB-SAMPLE",
      step: "review",
    });
    expect(state.submission).toBe("succeeded");
    expect(state.sessionId).toBe("sample-session");
  });

  it("allows ordered subsets and requires review to be last", () => {
    const config = copyConfig();
    config.steps = ["selfie", "details"];
    expect(configSchema.safeParse(config).success).toBe(true);
    config.steps = ["review", "details"];
    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it("validates required details and rejects future dates or malformed email", () => {
    expect(
      validateDetails({
        fullName: "",
        dateOfBirth: "",
        country: "",
        email: "",
      }),
    ).toEqual({
      fullName: "required",
      dateOfBirth: "required",
      country: "required",
      email: "required",
    });
    expect(
      validateDetails({
        fullName: "Sample Person",
        dateOfBirth: "2099-01-01",
        country: "IN",
        email: "bad",
      }),
    ).toEqual({
      dateOfBirth: "invalidDate",
      email: "invalidEmail",
    });
  });

  it("accepts a valid date of birth in the local timezone", () => {
    expect(
      validateDetails({
        fullName: "Sample Person",
        dateOfBirth: "1990-01-02",
        country: "IN",
        email: "sample@example.test",
      }),
    ).toEqual({});
  });
});
