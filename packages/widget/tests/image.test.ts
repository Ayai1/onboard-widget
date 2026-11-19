import { afterEach, describe, expect, it, vi } from "vitest";
import { getQualityHints, resizeAndCompress } from "../src/camera/image";

let originalToBlob: PropertyDescriptor | undefined;

describe("image processing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToBlob) {
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        "toBlob",
        originalToBlob,
      );
    } else {
      Reflect.deleteProperty(HTMLCanvasElement.prototype, "toBlob");
    }
  });

  it("downscales the longer edge and encodes a JPEG blob", async () => {
    let createdCanvas: HTMLCanvasElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((
      name: string,
      options?: ElementCreationOptions,
    ) => {
      const element = originalCreateElement(name, options);
      if (name === "canvas") createdCanvas = element as HTMLCanvasElement;
      return element;
    }) as typeof document.createElement);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    originalToBlob = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "toBlob",
    );
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) =>
        callback(new Blob(["compressed"], { type: "image/jpeg" })),
    });
    const result = await resizeAndCompress(
      {} as CanvasImageSource,
      4000,
      2000,
      1000,
      0.8,
    );
    expect(createdCanvas?.width).toBe(1000);
    expect(createdCanvas?.height).toBe(500);
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.byteSize).toBe(result.blob.size);
  });

  it("returns dark and blurry hints from a synthetic image", async () => {
    const bitmap = { width: 4, height: 4, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < rgba.length; index += 4) {
      rgba[index] = 20;
      rgba[index + 1] = 20;
      rgba[index + 2] = 20;
      rgba[index + 3] = 255;
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: rgba })),
    } as unknown as CanvasRenderingContext2D);
    expect(
      await getQualityHints(new Blob(["synthetic"], { type: "image/jpeg" })),
    ).toEqual(["tooDark", "tooBlurry"]);
    expect(bitmap.close).toHaveBeenCalled();
  });
});
