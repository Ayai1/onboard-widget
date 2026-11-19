import { z } from "zod";

export const stepIds = ["details", "id_capture", "selfie", "review"] as const;
export type StepId = (typeof stepIds)[number];

const stepSchema = z.enum(stepIds);
const themeSchema = z.object({
  primaryColor: z.string().min(1),
  backgroundColor: z.string().min(1),
  textColor: z.string().min(1),
  radius: z.string().min(1),
  fontFamily: z.string().min(1),
  logoUrl: z.string().url().optional(),
});

export const configSchema = z
  .object({
    steps: z.array(stepSchema).min(1),
    theme: themeSchema,
    locale: z.enum(["en", "ar"]),
    strings: z.record(z.string(), z.string()).optional(),
    api: z.object({
      baseUrl: z.string().url(),
      publicKey: z.string().min(1),
    }),
    camera: z.object({
      idMaxDimension: z.number().int().positive(),
      selfieMaxDimension: z.number().int().positive(),
      jpegQuality: z.number().min(0).max(1),
    }),
    analytics: z.object({ enabled: z.boolean() }),
  })
  .superRefine((config, context) => {
    if (new Set(config.steps).size !== config.steps.length) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Step ids must be unique.",
      });
    }
    const reviewIndex = config.steps.indexOf("review");
    if (reviewIndex >= 0 && reviewIndex !== config.steps.length - 1) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Review must be the last step when included.",
      });
    }
  });

export type WidgetConfig = z.infer<typeof configSchema>;
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid Onboard Widget config:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}

export function validateConfig(value: unknown): WidgetConfig {
  const result = configSchema.safeParse(value);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "config";
        return `${path}: ${issue.message}`;
      }),
    );
  }
  return result.data;
}

export function mergeConfig(config: WidgetConfig, partial: DeepPartial<WidgetConfig>): WidgetConfig {
  return validateConfig(mergeRecords(config, partial));
}

function mergeRecords(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) return override ?? base;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in base ? mergeRecords(base[key], value) : value;
  }
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
