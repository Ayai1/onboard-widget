import { describe, expect, it } from "vitest";
import { ConfigError, mergeConfig, validateConfig } from "../src/config";
import { copyConfig, validConfig } from "./fixtures";

describe("runtime config", () => {
  it("accepts a complete config and keeps optional locale overrides", () => {
    const config = validateConfig({
      ...validConfig,
      strings: { continue: "Next" },
    });
    expect(config.steps).toEqual(["details", "id_capture", "selfie", "review"]);
    expect(config.strings?.continue).toBe("Next");
  });

  it.each([
    [
      "empty steps",
      (config: Record<string, unknown>) => {
        config.steps = [];
      },
    ],
    [
      "unknown step",
      (config: Record<string, unknown>) => {
        config.steps = ["details", "passport"];
      },
    ],
    [
      "duplicate steps",
      (config: Record<string, unknown>) => {
        config.steps = ["details", "details"];
      },
    ],
    [
      "review ordering",
      (config: Record<string, unknown>) => {
        config.steps = ["review", "details"];
      },
    ],
    [
      "primary color",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).primaryColor = "";
      },
    ],
    [
      "malformed color",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).primaryColor = "not a color";
      },
    ],
    [
      "background color",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).backgroundColor = "";
      },
    ],
    [
      "text color",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).textColor = "";
      },
    ],
    [
      "radius",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).radius = "";
      },
    ],
    [
      "malformed radius",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).radius = "wide";
      },
    ],
    [
      "font family",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).fontFamily = "";
      },
    ],
    [
      "logo URL",
      (config: Record<string, unknown>) => {
        (config.theme as Record<string, unknown>).logoUrl = "not a URL";
      },
    ],
    [
      "locale",
      (config: Record<string, unknown>) => {
        config.locale = "fr";
      },
    ],
    [
      "override type",
      (config: Record<string, unknown>) => {
        config.strings = { continue: 12 };
      },
    ],
    [
      "base URL",
      (config: Record<string, unknown>) => {
        (config.api as Record<string, unknown>).baseUrl = "invalid";
      },
    ],
    [
      "non-HTTP base URL",
      (config: Record<string, unknown>) => {
        (config.api as Record<string, unknown>).baseUrl = "ftp://example.test";
      },
    ],
    [
      "public key",
      (config: Record<string, unknown>) => {
        (config.api as Record<string, unknown>).publicKey = "";
      },
    ],
    [
      "ID dimension",
      (config: Record<string, unknown>) => {
        (config.camera as Record<string, unknown>).idMaxDimension = 0;
      },
    ],
    [
      "selfie dimension",
      (config: Record<string, unknown>) => {
        (config.camera as Record<string, unknown>).selfieMaxDimension = -1;
      },
    ],
    [
      "JPEG quality high",
      (config: Record<string, unknown>) => {
        (config.camera as Record<string, unknown>).jpegQuality = 1.1;
      },
    ],
    [
      "JPEG quality low",
      (config: Record<string, unknown>) => {
        (config.camera as Record<string, unknown>).jpegQuality = -0.1;
      },
    ],
    [
      "analytics type",
      (config: Record<string, unknown>) => {
        config.analytics = { enabled: "yes" };
      },
    ],
  ])("rejects an invalid %s value", (_, invalidate) => {
    const config = copyConfig() as unknown as Record<string, unknown>;
    invalidate(config);
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it("lists all config problems in one typed error", () => {
    const config = copyConfig() as unknown as Record<string, unknown>;
    config.locale = "fr";
    (config.api as Record<string, unknown>).baseUrl = "invalid";
    (config.camera as Record<string, unknown>).jpegQuality = 2;
    try {
      validateConfig(config);
      throw new Error("Validation unexpectedly succeeded.");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).problems).toHaveLength(3);
    }
  });

  it("merges partial values and validates the result", () => {
    const updated = mergeConfig(validConfig, {
      theme: { primaryColor: "#16745e" },
      locale: "ar",
    });
    expect(updated.theme.primaryColor).toBe("#16745e");
    expect(updated.locale).toBe("ar");
    expect(updated.theme.backgroundColor).toBe(
      validConfig.theme.backgroundColor,
    );
  });
});
