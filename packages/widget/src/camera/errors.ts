export type CameraErrorReason =
  | "permission_denied"
  | "no_camera"
  | "camera_in_use"
  | "unsupported_constraints"
  | "insecure_context"
  | "unsupported_browser";

export class CameraError extends Error {
  readonly reason: CameraErrorReason;

  constructor(reason: CameraErrorReason, message = reason) {
    super(message);
    this.name = "CameraError";
    this.reason = reason;
  }
}

export function mapCameraError(error: unknown): CameraErrorReason {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = String((error as { name?: unknown }).name);
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "permission_denied";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") return "no_camera";
    if (name === "NotReadableError" || name === "TrackStartError") return "camera_in_use";
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "unsupported_constraints";
    }
  }
  return "unsupported_browser";
}
