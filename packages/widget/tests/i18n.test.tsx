import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowApp } from "../src/FlowApp";
import { AnalyticsEmitter } from "../src/analytics";
import { textDirection, translate } from "../src/i18n";
import { copyConfig } from "./fixtures";

afterEach(() => cleanup());

describe("localization", () => {
  it("looks up translations and applies an override", () => {
    const config = copyConfig();
    expect(translate(config, "continue")).toBe("Continue");
    config.locale = "ar";
    config.strings = { continue: "التالي" };
    expect(translate(config, "continue")).toBe("التالي");
    expect(textDirection(config)).toBe("rtl");
  });

  it("sets Arabic language and RTL direction on the flow root", () => {
    const config = copyConfig();
    config.locale = "ar";
    config.analytics.enabled = false;
    const analytics = new AnalyticsEmitter(config, vi.fn());
    render(<FlowApp config={config} analytics={analytics} />);
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("main")).toHaveAttribute("lang", "ar");
    analytics.destroy();
  });
});
