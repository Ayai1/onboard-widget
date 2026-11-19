export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
}

export interface QualityHintOptions {
  maxAnalysisDimension?: number;
  darkThreshold?: number;
  blurThreshold?: number;
}

export async function resizeAndCompress(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
  quality: number,
): Promise<PreparedImage> {
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error("The image has no readable dimensions.");
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas image processing is not available.");
  context.drawImage(source, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, "image/jpeg", Math.min(1, Math.max(0, quality)));
  return { blob, width, height, byteSize: blob.size };
}

export async function prepareUploadedFile(
  file: File,
  maxDimension: number,
  quality: number,
): Promise<PreparedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      return await resizeAndCompress(bitmap, bitmap.width, bitmap.height, maxDimension, quality);
    } finally {
      bitmap.close();
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return await resizeAndCompress(image, image.naturalWidth, image.naturalHeight, maxDimension, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function getQualityHints(
  blob: Blob,
  options: QualityHintOptions = {},
): Promise<string[]> {
  const image = await decodeBlob(blob);
  try {
    const maxDimension = options.maxAnalysisDimension ?? 256;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(3, Math.round(image.width * scale));
    const height = Math.max(3, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image.source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const luminance = new Float32Array(width * height);
    let mean = 0;
    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 4;
      const value = pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 + pixels[offset + 2]! * 0.0722;
      luminance[index] = value;
      mean += value;
    }
    mean /= luminance.length;
    let laplacianMean = 0;
    let count = 0;
    const laplacians: number[] = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const value =
          luminance[index - width]! + luminance[index - 1]! - 4 * luminance[index]! +
          luminance[index + 1]! + luminance[index + width]!;
        laplacians.push(value);
        laplacianMean += value;
        count += 1;
      }
    }
    laplacianMean /= count || 1;
    let laplacianVariance = 0;
    for (const value of laplacians) laplacianVariance += (value - laplacianMean) ** 2;
    laplacianVariance /= count || 1;

    const hints: string[] = [];
    if (mean < (options.darkThreshold ?? 55)) hints.push("tooDark");
    if (laplacianVariance < (options.blurThreshold ?? 70)) hints.push("tooBlurry");
    return hints;
  } finally {
    image.close?.();
  }
}

async function decodeBlob(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected file is not a readable image."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the image."));
    }, type, quality);
  });
}
