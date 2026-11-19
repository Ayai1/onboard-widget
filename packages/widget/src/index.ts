import React, { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FlowApp } from "./FlowApp";
import { mergeConfig, validateConfig, type DeepPartial, type WidgetConfig, ConfigError } from "./config";
import styles from "./widget.css?inline";

export { ConfigError, configSchema, stepIds, validateConfig } from "./config";
export type { DeepPartial, StepId, WidgetConfig } from "./config";
export { messages, stepLabel, textDirection, translate } from "./i18n";
export { themeVariables } from "./theme";

export interface CompleteResult {
  sessionId: string;
  reference: string;
}

export interface WidgetEvent {
  type: string;
  sessionId: string;
  step: string;
  timestamp: string;
  locale: "en" | "ar";
  deviceClass: "ios" | "android" | "desktop";
  reason?: string;
}

export interface InitOptions {
  container: HTMLElement;
  config: WidgetConfig;
  onComplete: (result: CompleteResult) => void;
  onError: (error: Error) => void;
  onEvent?: (event: WidgetEvent) => void;
}

export interface WidgetHandle {
  destroy(): void;
  updateConfig(partial: DeepPartial<WidgetConfig>): void;
}

export function init(options: InitOptions): WidgetHandle {
  let config = validateConfig(options.config);
  const shadow = options.container.shadowRoot ?? options.container.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const mount = document.createElement("div");
  mount.className = "ow-mount";
  shadow.append(style, mount);
  const root: Root = createRoot(mount);
  root.render(createElement(FlowApp, { config, onComplete: options.onComplete, onError: options.onError }));
  return {
    destroy() {
      root.unmount();
      style.remove();
      mount.remove();
    },
    updateConfig(partial) {
      try {
        config = mergeConfig(config, partial);
        root.render(createElement(FlowApp, { config, onComplete: options.onComplete, onError: options.onError }));
      } catch (error) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}

export class OnboardWidgetElement extends HTMLElement {
  static observedAttributes = ["config"];
  private handle?: WidgetHandle;

  connectedCallback() {
    this.mountFromAttribute();
  }

  disconnectedCallback() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  attributeChangedCallback(name: string) {
    if (name === "config" && this.isConnected) this.mountFromAttribute();
  }

  private mountFromAttribute() {
    this.handle?.destroy();
    try {
      const raw = this.getAttribute("config");
      if (!raw) throw new ConfigError(["config: attribute is required and must contain JSON."]);
      const config = validateConfig(JSON.parse(raw) as unknown);
      this.handle = init({
        container: this,
        config,
        onComplete: (result) => this.dispatch("onboard:complete", result),
        onError: (error) => this.dispatch("onboard:error", { name: error.name, message: error.message }),
        onEvent: (event) => this.dispatch("onboard:event", event),
      });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.dispatch("onboard:error", { name: normalized.name, message: normalized.message });
    }
  }

  private dispatch(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

if (typeof customElements !== "undefined" && !customElements.get("onboard-widget")) {
  customElements.define("onboard-widget", OnboardWidgetElement);
}
