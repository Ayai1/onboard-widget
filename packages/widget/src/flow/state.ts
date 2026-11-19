import type { StepId, WidgetConfig } from "../config";

export interface DetailsData {
  fullName: string;
  dateOfBirth: string;
  country: string;
  email: string;
}

export interface CapturedImage {
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  previewUrl: string;
  hints: string[];
}

export type StepStatus = "pending" | "valid" | "failed";
export type SubmissionStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface FlowState {
  steps: StepId[];
  currentStep: StepId;
  details: DetailsData;
  images: Partial<Record<"id_capture" | "selfie", CapturedImage>>;
  status: Record<StepId, StepStatus>;
  errors: Record<string, string>;
  submission: SubmissionStatus;
  reference?: string;
}

export type FlowAction =
  | { type: "set_steps"; steps: StepId[] }
  | { type: "navigate"; step: StepId }
  | { type: "set_details"; details: DetailsData }
  | { type: "set_image"; step: "id_capture" | "selfie"; image: CapturedImage }
  | { type: "step_valid"; step: StepId }
  | { type: "step_failed"; step: StepId; errors: Record<string, string> }
  | { type: "submit_started" }
  | { type: "submit_succeeded"; reference: string }
  | { type: "submit_failed"; message: string };

export const emptyDetails: DetailsData = {
  fullName: "",
  dateOfBirth: "",
  country: "",
  email: "",
};

export function createInitialFlowState(steps: StepId[], details: DetailsData = emptyDetails): FlowState {
  const firstStep = steps[0] ?? "details";
  return {
    steps: [...steps],
    currentStep: firstStep,
    details: { ...details },
    images: {},
    status: { details: "pending", id_capture: "pending", selfie: "pending", review: "pending" },
    errors: {},
    submission: "idle",
  };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "set_steps":
      return {
        ...state,
        steps: [...action.steps],
        currentStep: action.steps.includes(state.currentStep)
          ? state.currentStep
          : (action.steps[0] ?? "details"),
      };
    case "navigate":
      return state.steps.includes(action.step)
        ? { ...state, currentStep: action.step, errors: {} }
        : state;
    case "set_details":
      return { ...state, details: action.details, errors: {} };
    case "set_image":
      return { ...state, images: { ...state.images, [action.step]: action.image }, errors: {} };
    case "step_valid":
      return {
        ...state,
        status: { ...state.status, [action.step]: "valid" },
        errors: {},
      };
    case "step_failed":
      return {
        ...state,
        status: { ...state.status, [action.step]: "failed" },
        errors: action.errors,
      };
    case "submit_started":
      return { ...state, submission: "submitting", errors: {} };
    case "submit_succeeded":
      return { ...state, submission: "succeeded", reference: action.reference };
    case "submit_failed":
      return { ...state, submission: "failed", errors: { submit: action.message } };
  }
}

export function validateDetails(details: DetailsData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!details.fullName.trim()) errors.fullName = "required";
  if (!details.dateOfBirth) errors.dateOfBirth = "required";
  else if (!isValidDateOfBirth(details.dateOfBirth)) errors.dateOfBirth = "invalidDate";
  if (!details.country) errors.country = "required";
  if (!details.email.trim()) errors.email = "required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) errors.email = "invalidEmail";
  return errors;
}

function isValidDateOfBirth(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= today;
}

const storageKey = (config: WidgetConfig) => `onboard-widget-details:${config.api.baseUrl}:${config.api.publicKey}`;

export function readStoredDetails(config: WidgetConfig): DetailsData {
  try {
    const serialized = window.sessionStorage.getItem(storageKey(config));
    if (!serialized) return { ...emptyDetails };
    const parsed: unknown = JSON.parse(serialized);
    if (!isDetailsData(parsed)) return { ...emptyDetails };
    return parsed;
  } catch {
    return { ...emptyDetails };
  }
}

export function persistDetails(config: WidgetConfig, details: DetailsData): void {
  try {
    window.sessionStorage.setItem(storageKey(config), JSON.stringify(details));
  } catch {
    return;
  }
}

function isDetailsData(value: unknown): value is DetailsData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return ["fullName", "dateOfBirth", "country", "email"].every(
    (key) => typeof record[key] === "string",
  );
}
