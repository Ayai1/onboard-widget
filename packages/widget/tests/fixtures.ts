import type { WidgetConfig } from "../src/config";

export const validConfig: WidgetConfig = {
  steps: ["details", "id_capture", "selfie", "review"],
  theme: {
    primaryColor: "#2459d3",
    backgroundColor: "#ffffff",
    textColor: "#172033",
    radius: "16px",
    fontFamily: "system-ui, sans-serif",
  },
  locale: "en",
  api: { baseUrl: "http://127.0.0.1:8000", publicKey: "demo-public-key" },
  camera: { idMaxDimension: 1600, selfieMaxDimension: 1200, jpegQuality: 0.82 },
  analytics: { enabled: true },
};

export function copyConfig(): WidgetConfig {
  return structuredClone(validConfig);
}
