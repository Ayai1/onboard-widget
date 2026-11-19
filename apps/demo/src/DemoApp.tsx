import { useEffect, useMemo, useRef, useState } from "react";
import {
  init,
  type WidgetConfig,
  type WidgetEvent,
  type WidgetHandle,
} from "@onboard/widget";
import { demoApiBaseUrl, hostedDemoMode } from "./demoApi";

const themes = {
  ocean: {
    primaryColor: "#2459d3",
    backgroundColor: "#ffffff",
    textColor: "#172033",
    radius: "18px",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  meadow: {
    primaryColor: "#16745e",
    backgroundColor: "#f5fbf8",
    textColor: "#18332b",
    radius: "10px",
    fontFamily: "Georgia, ui-serif, serif",
  },
} as const;

export default function DemoApp() {
  const mount = useRef<HTMLDivElement>(null);
  const widgetHandle = useRef<WidgetHandle | null>(null);
  const [themeName, setThemeName] = useState<keyof typeof themes>("ocean");
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [reference, setReference] = useState("");
  const [lastError, setLastError] = useState("");
  const [events, setEvents] = useState<WidgetEvent[]>([]);
  const config = useMemo<WidgetConfig>(
    () => ({
      steps: ["details", "id_capture", "selfie", "review"],
      theme: themes[themeName],
      locale,
      api: { baseUrl: demoApiBaseUrl(), publicKey: "demo-public-key" },
      camera: {
        idMaxDimension: 1600,
        selfieMaxDimension: 1200,
        jpegQuality: 0.82,
      },
      analytics: { enabled: !hostedDemoMode },
    }),
    [locale, themeName],
  );
  const [initialConfig] = useState(config);
  const appliedConfig = useRef(initialConfig);

  useEffect(() => {
    if (!mount.current) return;
    const currentHandle = init({
      container: mount.current,
      config: initialConfig,
      onComplete: (result) => {
        setReference(result.reference);
        setLastError("");
      },
      onError: (error) => setLastError(error.message),
      onEvent: (event) =>
        setEvents((previous) => [...previous.slice(-5), event]),
    });
    widgetHandle.current = currentHandle;
    return () => {
      currentHandle.destroy();
      widgetHandle.current = null;
    };
  }, [initialConfig]);

  useEffect(() => {
    if (appliedConfig.current === config) return;
    widgetHandle.current?.updateConfig(config);
    appliedConfig.current = config;
  }, [config]);

  const homePath = import.meta.env.BASE_URL;
  const funnelPath = new URL("funnel", window.location.origin + homePath)
    .pathname;
  const funnelQuery = new URLSearchParams(window.location.search).get("page");
  if (window.location.pathname === funnelPath || funnelQuery === "funnel")
    return <FunnelPage />;

  return (
    <main className="demo-page" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="demo-header">
        <div>
          <p className="eyebrow">Embed demo</p>
          <h1>Onboard Widget</h1>
        </div>
        <a href={`${homePath}?page=funnel`}>View funnel</a>
      </header>
      <p className="demo-notice">Demo only - do not upload real documents</p>
      {hostedDemoMode && (
        <p className="demo-notice">
          The hosted demo simulates submissions in this browser. Captures are
          not sent to a server.
        </p>
      )}
      <section className="demo-controls" aria-label="Widget settings">
        <label>
          Theme
          <select
            value={themeName}
            onChange={(event) =>
              setThemeName(event.currentTarget.value as keyof typeof themes)
            }
          >
            <option value="ocean">Ocean</option>
            <option value="meadow">Meadow</option>
          </select>
        </label>
        <label>
          Language
          <select
            value={locale}
            onChange={(event) =>
              setLocale(event.currentTarget.value as "en" | "ar")
            }
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </section>
      <section className="widget-panel" aria-label="Onboard Widget flow">
        <div id="widget-mount" ref={mount} />
      </section>
      {reference && (
        <p role="status">
          Submission reference: <strong>{reference}</strong>
        </p>
      )}
      {lastError && (
        <p className="demo-error" role="alert">
          {lastError}
        </p>
      )}
      <section className="event-panel">
        <h2>Recent widget events</h2>
        {events.length === 0 ? (
          <p>Events appear here as the flow progresses.</p>
        ) : (
          <ul>
            {events.map((event, index) => (
              <li key={`${event.timestamp}-${index}`}>
                {event.type} · {event.step}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

interface FunnelStep {
  step: string;
  count: number;
  dropOffPercent: number;
}

function FunnelPage() {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const maxCount = Math.max(1, ...steps.map((item) => item.count));

  useEffect(() => {
    let active = true;
    fetch(`${demoApiBaseUrl()}/funnel`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Funnel request failed (${response.status}).`);
        return (await response.json()) as { steps: FunnelStep[] };
      })
      .then((data) => {
        if (active) setSteps(data.steps);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Funnel data is unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="demo-page funnel-page">
      <header className="demo-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Onboarding funnel</h1>
        </div>
        <a href={import.meta.env.BASE_URL}>Return to demo</a>
      </header>
      {hostedDemoMode && (
        <p className="demo-notice">
          Synthetic funnel counts are not collected from visitors.
        </p>
      )}
      {loading && <p role="status">Loading funnel…</p>}
      {error && (
        <p className="demo-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && (
        <div className="funnel-list">
          {steps.map((item) => (
            <article className="funnel-step" key={item.step}>
              <div className="funnel-label">
                <h2>{item.step.replaceAll("_", " ")}</h2>
                <span>{item.count} sessions</span>
              </div>
              <div
                className="funnel-track"
                aria-label={`${item.count} sessions`}
              >
                <span
                  style={{
                    width: `${Math.min(100, (item.count / maxCount) * 100)}%`,
                  }}
                />
              </div>
              <p>{item.dropOffPercent}% drop-off</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
