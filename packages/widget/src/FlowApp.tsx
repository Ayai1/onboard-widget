import type { WidgetConfig } from "./config";
import { translate, textDirection } from "./i18n";
import { themeVariables } from "./theme";

export interface FlowAppProps {
  config: WidgetConfig;
}

export function FlowApp({ config }: FlowAppProps) {
  const style = themeVariables(config) as React.CSSProperties;
  return (
    <main className="ow-root" style={style} dir={textDirection(config)} lang={config.locale}>
      <h1>{translate(config, "title")}</h1>
      <ol aria-label="Onboarding steps">
        {config.steps.map((step) => (
          <li key={step}>{translate(config, step)}</li>
        ))}
      </ol>
    </main>
  );
}
