import { useCallback, useEffect, useRef, useState } from "react";
import { CameraError, mapCameraError, type CameraErrorReason } from "./errors";

export type CameraMode = "environment" | "user";
export interface CameraOptions {
  mode: CameraMode;
}

export function useCamera({ mode }: CameraOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const selectedDeviceRef = useRef<string | undefined>(undefined);
  const restartWhenVisibleRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorReason | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [starting, setStarting] = useState(false);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(allDevices.filter((device) => device.kind === "videoinput"));
    } catch {
      setDevices([]);
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    if (!window.isSecureContext) {
      setError("insecure_context");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported_browser");
      return;
    }
    const requestId = ++requestIdRef.current;
    setStarting(true);
    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(selectedDeviceRef.current ? { deviceId: { ideal: selectedDeviceRef.current } } : {}),
        },
      };
      const nextStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = nextStream;
      setStream(nextStream);
      await refreshDevices();
    } catch (caught) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        const reason = mapCameraError(caught);
        setError(reason);
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setStarting(false);
    }
  }, [mode, refreshDevices, stop]);

  const selectDevice = useCallback((deviceId: string) => {
    selectedDeviceRef.current = deviceId || undefined;
    setSelectedDeviceId(deviceId);
    if (streamRef.current) void start();
  }, [start]);

  useEffect(() => {
    mountedRef.current = true;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        restartWhenVisibleRef.current = streamRef.current !== null;
        stop();
      } else if (restartWhenVisibleRef.current) {
        restartWhenVisibleRef.current = false;
        void start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const mediaDevices = navigator.mediaDevices;
    const handleDeviceChange = () => void refreshDevices();
    mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      document.removeEventListener("visibilitychange", handleVisibility);
      mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [refreshDevices, start, stop]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return { videoRef, stream, error, devices, selectedDeviceId, starting, start, stop, selectDevice };
}
