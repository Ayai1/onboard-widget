import { lazy, Suspense, useEffect, useReducer, useRef } from "react";
import type { StepId, WidgetConfig } from "./config";
import { translate, textDirection } from "./i18n";
import { themeVariables } from "./theme";
import { DetailsStep } from "./DetailsStep";
import {
  createInitialFlowState,
  flowReducer,
  persistDetails,
  readStoredDetails,
  validateDetails,
} from "./flow/state";
import { createSession, submitSession, uploadDocument } from "./api";
import { ReviewStep } from "./ReviewStep";
import type { AnalyticsEmitter } from "./analytics";
import type { CameraErrorReason } from "./camera/errors";

const CameraStep = lazy(() =>
  import("./CameraStep").then((module) => ({ default: module.CameraStep })),
);

export interface FlowAppProps {
  config: WidgetConfig;
  onComplete?: (result: { sessionId: string; reference: string }) => void;
  onError?: (error: Error) => void;
  analytics: AnalyticsEmitter;
}

export function FlowApp({
  config,
  onComplete,
  onError,
  analytics,
}: FlowAppProps) {
  const [state, dispatch] = useReducer(flowReducer, config, (initialConfig) =>
    createInitialFlowState(
      initialConfig.steps,
      readStoredDetails(initialConfig),
    ),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const previewUrls = useRef(new Set<string>());
  const submissionLock = useRef(false);
  const lastViewedStep = useRef<StepId | null>(null);
  const style = themeVariables(config) as React.CSSProperties;
  const stepIndex = state.steps.indexOf(state.currentStep);

  useEffect(() => {
    persistDetails(config, state.details);
  }, [config, state.details]);

  useEffect(() => {
    if (state.steps.join("|") !== config.steps.join("|")) {
      dispatch({ type: "set_steps", steps: [...config.steps] });
    }
  }, [config.steps, state.steps]);

  useEffect(() => {
    heading.current?.focus();
  }, [state.currentStep, state.submission]);

  useEffect(() => {
    if (lastViewedStep.current !== state.currentStep) {
      lastViewedStep.current = state.currentStep;
      analytics.emit("step_viewed", state.currentStep);
    }
  }, [analytics, state.currentStep]);

  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
      previewUrls.current.clear();
    },
    [],
  );

  const continueFromDetails = () => {
    const errors = validateDetails(state.details);
    if (Object.keys(errors).length) {
      dispatch({ type: "step_failed", step: "details", errors });
      analytics.emit("step_failed", "details", "validation_failed");
      return;
    }
    dispatch({ type: "step_valid", step: "details" });
    analytics.emit("step_completed", "details");
    if (state.steps[stepIndex + 1]) goForward();
    else void submit();
  };

  const goForward = () => {
    const next = state.steps[stepIndex + 1];
    if (next) dispatch({ type: "navigate", step: next });
  };

  const goBack = () => {
    const previous = state.steps[stepIndex - 1];
    if (previous) dispatch({ type: "navigate", step: previous });
  };

  const submit = async () => {
    if (state.submission === "submitting" || submissionLock.current) return;
    const detailErrors = validateDetails(state.details);
    const missing = (["id_capture", "selfie"] as const).filter(
      (step) => !state.images[step],
    );
    const missingConfiguredStep =
      (Object.keys(detailErrors).length > 0 &&
        !config.steps.includes("details")) ||
      missing.some((step) => !config.steps.includes(step));
    if (missingConfiguredStep) {
      const message = translate(config, "configMissingSteps");
      dispatch({ type: "submit_failed", step: state.currentStep, message });
      analytics.emit(
        "step_failed",
        state.currentStep,
        "required_step_not_configured",
      );
      onError?.(new Error(message));
      return;
    }
    if (Object.keys(detailErrors).length || missing.length) {
      if (Object.keys(detailErrors).length) {
        dispatch({
          type: "step_failed",
          step: "details",
          errors: detailErrors,
        });
      }
      for (const step of missing) {
        if (config.steps.includes(step)) {
          dispatch({
            type: "step_failed",
            step,
            errors: { [step]: "required" },
          });
        }
      }
      analytics.emit("step_failed", state.currentStep, "required_data_missing");
      const firstMissing = config.steps.find(
        (step) =>
          Object.hasOwn(detailErrors, step) ||
          missing.includes(step as "id_capture" | "selfie"),
      );
      if (
        firstMissing &&
        firstMissing !== state.currentStep &&
        firstMissing !== "review"
      ) {
        dispatch({ type: "navigate", step: firstMissing });
        dispatch({
          type: "step_failed",
          step: firstMissing,
          errors:
            firstMissing === "details"
              ? detailErrors
              : { [firstMissing]: "required" },
        });
      }
      return;
    }
    submissionLock.current = true;
    dispatch({ type: "submit_started" });
    analytics.emit("submit_started", state.currentStep);
    try {
      const sessionId = state.sessionId ?? (await createSession(config));
      if (!state.sessionId) dispatch({ type: "session_created", sessionId });
      const idImage = state.images.id_capture;
      const selfieImage = state.images.selfie;
      if (idImage) await uploadDocument(config, sessionId, "id_front", idImage);
      if (selfieImage)
        await uploadDocument(config, sessionId, "selfie", selfieImage);
      const reference = await submitSession(config, sessionId, state.details);
      dispatch({
        type: "submit_succeeded",
        reference,
        step: state.currentStep,
      });
      analytics.emit("step_completed", state.currentStep);
      analytics.emit("submit_succeeded", state.currentStep);
      onComplete?.({ sessionId, reference });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate(config, "error");
      dispatch({ type: "submit_failed", step: state.currentStep, message });
      analytics.emit("step_failed", state.currentStep, "submit_error");
      analytics.emit("submit_failed", state.currentStep, "request_failed");
      onError?.(error instanceof Error ? error : new Error(message));
    } finally {
      submissionLock.current = false;
    }
  };

  const title = translate(
    config,
    state.submission === "succeeded" ? "done" : state.currentStep,
  );
  const content =
    state.submission === "succeeded" ? (
      <section className="ow-done">
        <p>
          {translate(config, "reference")}: <strong>{state.reference}</strong>
        </p>
      </section>
    ) : state.currentStep === "details" ? (
      <DetailsStep
        config={config}
        value={state.details}
        errors={state.errors}
        onChange={(details) => dispatch({ type: "set_details", details })}
        onContinue={continueFromDetails}
      />
    ) : state.currentStep === "id_capture" || state.currentStep === "selfie" ? (
      <Suspense
        fallback={<p aria-live="polite">{translate(config, "startCamera")}</p>}
      >
        <CameraStep
          config={config}
          kind={state.currentStep}
          captured={state.images[state.currentStep]}
          requiredError={state.errors[state.currentStep] === "required"}
          onCaptured={(image) => {
            previewUrls.current.add(image.previewUrl);
            const oldUrl =
              state.images[state.currentStep as "id_capture" | "selfie"]
                ?.previewUrl;
            if (oldUrl) {
              URL.revokeObjectURL(oldUrl);
              previewUrls.current.delete(oldUrl);
            }
            dispatch({
              type: "set_image",
              step: state.currentStep as "id_capture" | "selfie",
              image,
            });
          }}
          onContinue={() => {
            dispatch({ type: "step_valid", step: state.currentStep });
            if (state.steps[stepIndex + 1]) goForward();
            else void submit();
          }}
          onRetake={() => {
            const oldUrl =
              state.images[state.currentStep as "id_capture" | "selfie"]
                ?.previewUrl;
            if (oldUrl) {
              URL.revokeObjectURL(oldUrl);
              previewUrls.current.delete(oldUrl);
            }
            dispatch({
              type: "clear_image",
              step: state.currentStep as "id_capture" | "selfie",
            });
          }}
          onCameraError={(reason: CameraErrorReason) => {
            if (reason === "permission_denied")
              analytics.emit(
                "camera_permission_denied",
                state.currentStep as "id_capture" | "selfie",
                reason,
              );
          }}
          onUploadFallback={() =>
            analytics.emit(
              "upload_fallback_used",
              state.currentStep as "id_capture" | "selfie",
            )
          }
        />
      </Suspense>
    ) : state.currentStep === "review" ? (
      <ReviewStep
        config={config}
        details={state.details}
        images={state.images}
        errors={state.errors}
        submitting={state.submission === "submitting"}
        onEdit={(step) => dispatch({ type: "navigate", step })}
        onSubmit={() => void submit()}
      />
    ) : (
      <section className="ow-step" aria-label={title}>
        <p>
          {state.currentStep === "review"
            ? translate(config, "review")
            : translate(config, "framing")}
        </p>
        <div className="ow-actions">
          <button className="ow-primary" type="button" onClick={goForward}>
            {translate(config, "continue")}
          </button>
        </div>
      </section>
    );

  return (
    <main
      className="ow-root"
      style={style}
      dir={textDirection(config)}
      lang={config.locale}
    >
      {config.theme.logoUrl && <div className="ow-logo" aria-hidden="true" />}
      <div
        className="ow-progress"
        aria-label={`${stepIndex + 1} / ${state.steps.length}`}
      >
        {state.steps.map((step, index) => (
          <span
            key={step}
            aria-current={step === state.currentStep ? "step" : undefined}
          >
            {index + 1}. {translate(config, step)}
          </span>
        ))}
      </div>
      <div className="ow-step" key={state.currentStep}>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {state.submission !== "succeeded" && stepIndex > 0 && (
          <button className="ow-muted ow-back" type="button" onClick={goBack}>
            {translate(config, "back")}
          </button>
        )}
        {state.errors.submit && state.currentStep !== "review" && (
          <p className="ow-error" role="alert" aria-live="assertive">
            {state.errors.submit}
          </p>
        )}
        {content}
      </div>
    </main>
  );
}
