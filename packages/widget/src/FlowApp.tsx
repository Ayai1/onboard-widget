import { useEffect, useReducer, useRef } from "react";
import type { WidgetConfig } from "./config";
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

export interface FlowAppProps {
  config: WidgetConfig;
  onComplete?: (result: { sessionId: string; reference: string }) => void;
  onError?: (error: Error) => void;
}

export function FlowApp({ config }: FlowAppProps) {
  const [state, dispatch] = useReducer(
    flowReducer,
    config,
    (initialConfig) => createInitialFlowState(initialConfig.steps, readStoredDetails(initialConfig)),
  );
  const heading = useRef<HTMLHeadingElement>(null);
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
  }, [state.currentStep]);

  const continueFromDetails = () => {
    const errors = validateDetails(state.details);
    if (Object.keys(errors).length) {
      dispatch({ type: "step_failed", step: "details", errors });
      return;
    }
    dispatch({ type: "step_valid", step: "details" });
    goForward();
  };

  const goForward = () => {
    const next = state.steps[stepIndex + 1];
    if (next) dispatch({ type: "navigate", step: next });
  };

  const goBack = () => {
    const previous = state.steps[stepIndex - 1];
    if (previous) dispatch({ type: "navigate", step: previous });
  };

  const title = translate(config, state.currentStep);
  const content = state.currentStep === "details" ? (
    <DetailsStep
      config={config}
      value={state.details}
      errors={state.errors}
      onChange={(details) => dispatch({ type: "set_details", details })}
      onContinue={continueFromDetails}
    />
  ) : (
    <section className="ow-step" aria-label={title}>
      <p>{state.currentStep === "review" ? translate(config, "review") : translate(config, "framing")}</p>
      <div className="ow-actions">
        <button className="ow-primary" type="button" onClick={goForward}>
          {translate(config, "continue")}
        </button>
      </div>
    </section>
  );

  return (
    <main className="ow-root" style={style} dir={textDirection(config)} lang={config.locale}>
      <div className="ow-progress" aria-label={`${stepIndex + 1} / ${state.steps.length}`}>
        {state.steps.map((step, index) => (
          <span key={step} aria-current={step === state.currentStep ? "step" : undefined}>
            {index + 1}. {translate(config, step)}
          </span>
        ))}
      </div>
      <div className="ow-step" key={state.currentStep}>
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        {stepIndex > 0 && (
          <button className="ow-muted ow-back" type="button" onClick={goBack}>
            {translate(config, "back")}
          </button>
        )}
        {content}
      </div>
    </main>
  );
}
