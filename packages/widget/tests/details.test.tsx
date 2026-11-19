import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { copyConfig } from "./fixtures";
import { FlowApp } from "../src/FlowApp";
import { AnalyticsEmitter } from "../src/analytics";

afterEach(() => cleanup());

describe("details form", () => {
  it("shows labelled inline validation errors accessibly", () => {
    const config = copyConfig();
    config.analytics.enabled = false;
    const analytics = new AnalyticsEmitter(config);
    render(<FlowApp config={config} analytics={analytics} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const nameInput = screen.getByLabelText("Full name");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-describedby", "ow-fullName-error");
    expect(
      screen.getAllByText("This field is required.").length,
    ).toBeGreaterThan(1);
    analytics.destroy();
  });
});
