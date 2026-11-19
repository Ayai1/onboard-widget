import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapCameraError } from "../src/camera/errors";
import { CameraStep } from "../src/CameraStep";
import { useCamera } from "../src/camera/useCamera";
import { copyConfig } from "./fixtures";

function namedError(name: string) {
  return Object.assign(new Error(name), { name });
}

function installMediaDevices(getUserMedia: ReturnType<typeof vi.fn>) {
  const mediaDevices = {
    getUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([]),
  };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: mediaDevices,
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  return mediaDevices;
}

let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalToBlob: PropertyDescriptor | undefined;

beforeEach(() => {
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    "createObjectURL",
  );
  originalToBlob = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "toBlob",
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn().mockReturnValue("blob:synthetic-preview"),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    value: (callback: BlobCallback) =>
      callback(new Blob(["synthetic-jpeg"], { type: "image/jpeg" })),
  });
});

afterEach(() => {
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }
  if (originalToBlob) {
    Object.defineProperty(
      HTMLCanvasElement.prototype,
      "toBlob",
      originalToBlob,
    );
  } else {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, "toBlob");
  }
  vi.unstubAllGlobals();
});

describe("camera errors and lifecycle", () => {
  it.each([
    ["NotAllowedError", "permission_denied"],
    ["NotFoundError", "no_camera"],
    ["NotReadableError", "camera_in_use"],
    ["OverconstrainedError", "unsupported_constraints"],
    ["TypeError", "unsupported_browser"],
  ] as const)("maps %s to %s", (name, reason) => {
    expect(mapCameraError(namedError(name))).toBe(reason);
  });

  it("uses facingMode and ideal resolution constraints", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    installMediaDevices(getUserMedia);
    const camera = renderHook(() => useCamera({ mode: "environment" }));
    await act(async () => {
      await camera.result.current.start();
    });
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }),
      }),
    );
    camera.unmount();
  });

  it("shows the upload path after permission is denied and processes a selected image", async () => {
    installMediaDevices(
      vi.fn().mockRejectedValue(namedError("NotAllowedError")),
    );
    const bitmap = { width: 120, height: 90, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(120 * 90 * 4).fill(120),
      })),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })),
    );
    const onCaptured = vi.fn();
    render(
      <CameraStep
        config={copyConfig()}
        kind="id_capture"
        requiredError={false}
        onCaptured={onCaptured}
        onContinue={vi.fn()}
        onRetake={vi.fn()}
        onCameraError={vi.fn()}
        onUploadFallback={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start camera" }));
    expect(
      await screen.findByText(/Camera permission was denied/),
    ).toBeInTheDocument();
    const input = screen.getByLabelText(
      "Upload a photo instead",
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["synthetic"], "sample.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1));
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("stops every stream track on unmount", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    installMediaDevices(getUserMedia);
    const camera = renderHook(() => useCamera({ mode: "user" }));
    await act(async () => {
      await camera.result.current.start();
    });
    camera.unmount();
    expect(stopTrack).toHaveBeenCalledOnce();
  });
});
