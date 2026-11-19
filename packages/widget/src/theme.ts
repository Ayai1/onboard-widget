import type { WidgetConfig } from "./config";

export function themeVariables(config: WidgetConfig): Record<string, string> {
  return {
    "--ow-primary": config.theme.primaryColor,
    "--ow-background": config.theme.backgroundColor,
    "--ow-text": config.theme.textColor,
    "--ow-radius": config.theme.radius,
    "--ow-font-family": config.theme.fontFamily,
    "--ow-logo-url": config.theme.logoUrl
      ? `url(${JSON.stringify(config.theme.logoUrl)})`
      : "none",
  };
}
