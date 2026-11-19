import { useEffect, useRef, useState } from "react";
import type { WidgetConfig } from "./config";
import { translate } from "./i18n";
import {
  getQualityHints,
  prepareUploadedFile,
  resizeAndCompress,
} from "./camera/image";
import { useCamera } from "./camera/useCamera";
import type { CapturedImage } from "./flow/state";
import type { CameraErrorReason } from "./camera/errors";

export interface CameraStepProps {
  config: WidgetConfig;
  kind: "id_capture" | "selfie";
  captured?: CapturedImage;
  requiredError: boolean;
  onCaptured: (image: CapturedImage) => void;
  onContinue: () => void;
  onRetake: () => void;
  onCameraError: (reason: CameraErrorReason) => void;
  onUploadFallback: () => void;
}

const errorText: Record<string, string> = {
  permission_denied: "cameraPermission",
  no_camera: "noCamera",
  camera_in_use: "cameraBusy",
  unsupported_constraints: "cameraConstraints",
  insecure_context: "insecureContext",
  unsupported_browser: "unsupportedBrowser",
};

export function CameraStep({
  config,
  kind,
  captured,
  requiredError,
  onCaptured,
  onContinue,
  onRetake,
  onCameraError,
  onUploadFallback,
}: CameraStepProps) {
  const isSelfie = kind === "selfie";
  const {
    videoRef,
    stream,
    error,
    devices,
    selectedDeviceId,
    starting,
    start,
    stop,
    selectDevice,
  } = useCamera({ mode: isSelfie ? "user" : "environment" });
  const [readyStream, setReadyStream] = useState<MediaStream | null>(null);
  const videoReady = stream !== null && readyStream === stream;
  const [processing, setProcessing] = useState(false);
  const [fileError, setFileError] = useState("");
  const lastReportedError = useRef<string | null>(null);
  const maxDimension = isSelfie
    ? config.camera.selfieMaxDimension
    : config.camera.idMaxDimension;

  useEffect(() => {
    if (error && error !== lastReportedError.current) {
      lastReportedError.current = error;
      onCameraError(error);
    } else if (!error) {
      lastReportedError.current = null;
    }
  }, [error, onCameraError]);

  const acceptImage = async (prepared: {
    blob: Blob;
    width: number;
    height: number;
    byteSize: number;
  }) => {
    const hints = await getQualityHints(prepared.blob);
    const previewUrl = URL.createObjectURL(prepared.blob);
    onCaptured({ ...prepared, previewUrl, hints });
    stop();
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !videoReady || !video.videoWidth || !video.videoHeight)
      return;
    setProcessing(true);
    setFileError("");
    try {
      const prepared = await resizeAndCompress(
        video,
        video.videoWidth,
        video.videoHeight,
        maxDimension,
        config.camera.jpegQuality,
      );
      await acceptImage(prepared);
    } catch {
      setFileError(translate(config, "error"));
    } finally {
      setProcessing(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    setFileError("");
    try {
      const prepared = await prepareUploadedFile(
        file,
        maxDimension,
        config.camera.jpegQuality,
      );
      await acceptImage(prepared);
    } catch {
      setFileError(translate(config, "error"));
    } finally {
      setProcessing(false);
    }
  };

  const cameraMessage = error
    ? translate(config, errorText[error] ?? "error")
    : "";
  return (
    <section className="ow-camera" aria-label={translate(config, kind)}>
      {captured ? (
        <div className="ow-captured-preview">
          <img src={captured.previewUrl} alt={translate(config, kind)} />
          {captured.hints.length > 0 && (
            <ul className="ow-quality-hints" aria-live="polite">
              {captured.hints.map((hint) => (
                <li key={hint}>{translate(config, hint)}</li>
              ))}
            </ul>
          )}
          <div className="ow-actions">
            <button className="ow-muted" type="button" onClick={onRetake}>
              {translate(config, "retake")}
            </button>
            <button className="ow-primary" type="button" onClick={onContinue}>
              {translate(config, "continue")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`ow-video-frame ${isSelfie ? "ow-selfie" : ""}`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={translate(config, kind)}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  if (stream) setReadyStream(stream);
                  void video.play().catch(() => setReadyStream(null));
                }
              }}
            />
            {stream && !isSelfie && (
              <div className="ow-frame-guide" aria-hidden="true" />
            )}
            {!stream && <div className="ow-camera-empty" aria-hidden="true" />}
          </div>
          {!isSelfie && <p>{translate(config, "framing")}</p>}
          {requiredError && (
            <p className="ow-error" role="alert" aria-live="assertive">
              {translate(config, "required")}
            </p>
          )}
          {cameraMessage && (
            <div className="ow-error" role="alert" aria-live="assertive">
              <p>{cameraMessage}</p>
              {error !== "unsupported_browser" && (
                <button
                  className="ow-muted"
                  type="button"
                  onClick={() => {
                    setReadyStream(null);
                    void start();
                  }}
                  disabled={starting}
                >
                  {translate(config, "tryAgain")}
                </button>
              )}
              {(error === "permission_denied" ||
                error === "insecure_context") && (
                <details className="ow-settings-help">
                  <summary>{translate(config, "settingsHelp")}</summary>
                  <p>{translate(config, "settingsHelpBody")}</p>
                </details>
              )}
            </div>
          )}
          {devices.length > 1 && (
            <div className="ow-field">
              <label htmlFor={`ow-camera-${kind}`}>
                {translate(config, "switchCamera")}
              </label>
              <select
                id={`ow-camera-${kind}`}
                value={selectedDeviceId}
                onChange={(event) => {
                  setReadyStream(null);
                  selectDevice(event.currentTarget.value);
                }}
              >
                <option value="">
                  {translate(config, isSelfie ? "frontCamera" : "rearCamera")}
                </option>
                {devices.map((device, index) => (
                  <option value={device.deviceId} key={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="ow-actions ow-camera-actions">
            {!stream ? (
              <button
                className="ow-primary"
                type="button"
                onClick={() => {
                  setReadyStream(null);
                  void start();
                }}
                disabled={starting}
              >
                {translate(config, "startCamera")}
              </button>
            ) : (
              <button
                className="ow-primary"
                type="button"
                onClick={() => void capture()}
                disabled={!videoReady || processing}
              >
                {translate(config, "capture")}
              </button>
            )}
            <label className="ow-muted ow-upload">
              <span>{translate(config, "uploadInstead")}</span>
              <input
                type="file"
                accept="image/*"
                capture={isSelfie ? "user" : "environment"}
                onChange={(event) => {
                  if (event.currentTarget.files?.[0]) onUploadFallback();
                  void upload(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
                disabled={processing}
              />
            </label>
          </div>
          {(fileError || processing) && (
            <div aria-live="polite" className="ow-live">
              {processing ? translate(config, "processingImage") : fileError}
            </div>
          )}
        </>
      )}
    </section>
  );
}
