import {
  MAX_PHOTOS,
  MAX_REQUEST_BYTES,
  MAX_SOURCE_BYTES,
  MAX_TOTAL_SOURCE_BYTES,
} from "@/lib/memory/contract";

export type PhotoInput = {
  localId: string;
  file: File;
  previewUrl: string;
  analysisFile: File | null;
  position: number;
  readState: "ready" | "failed";
};

const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateSources(
  current: PhotoInput[],
  incoming: File[],
): string | null {
  if (current.length + incoming.length > MAX_PHOTOS)
    return `最多选择 9 张照片，当前已选 ${current.length} 张。`;
  if (incoming.some((file) => !accepted.has(file.type)))
    return "仅支持 JPEG、PNG、WebP 照片。";
  if (incoming.some((file) => file.size > MAX_SOURCE_BYTES))
    return "单张照片不能超过 10 MiB。";
  if (
    current.reduce((sum, photo) => sum + photo.file.size, 0) +
      incoming.reduce((sum, file) => sum + file.size, 0) >
    MAX_TOTAL_SOURCE_BYTES
  )
    return "全部照片不能超过 50 MiB。";
  return null;
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("照片压缩失败，请移除或更换照片。")),
      "image/jpeg",
      quality,
    ),
  );
}

async function compress(
  file: File,
  targetBytes: number,
  position: number,
): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`第 ${position + 1} 张照片无法读取，请移除或更换。`);
  }
  try {
    for (const edge of [1024, 768, 576, 432]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("照片压缩失败，请移除或更换照片。");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.66, 0.5, 0.36]) {
        const blob = await encode(canvas, quality);
        if (blob.size <= targetBytes)
          return new File([blob], `memory-${position}.jpg`, {
            type: "image/jpeg",
          });
      }
    }
    throw new Error("照片数据过大，请移除或更换照片后重试。");
  } finally {
    bitmap.close();
  }
}

export function estimatedMultipartBytes(
  files: File[],
  story: string,
  profile?: string,
  instruction?: string,
): number {
  return (
    files.reduce((sum, file) => sum + file.size + 300, 2048) +
    new TextEncoder().encode(story).length +
    new TextEncoder().encode(profile ?? "").length +
    new TextEncoder().encode(instruction ?? "").length
  );
}

export async function prepareAnalysisFiles(
  photos: PhotoInput[],
  story: string,
  profile?: string,
  instruction?: string,
): Promise<File[]> {
  const overhead = estimatedMultipartBytes([], story, profile, instruction);
  const budget = MAX_REQUEST_BYTES - overhead;
  if (budget < 100_000)
    throw new Error("照片数据过大，请移除或更换照片后重试。");
  const perPhoto = Math.floor(budget / photos.length) - 300;
  const result: File[] = [];
  for (const photo of photos) {
    if (photo.readState === "failed")
      throw new Error(
        `第 ${photo.position + 1} 张照片无法读取，请移除或更换。`,
      );
    const compressed = await compress(photo.file, perPhoto, photo.position);
    photo.analysisFile = compressed;
    result.push(compressed);
  }
  if (
    estimatedMultipartBytes(result, story, profile, instruction) >
    MAX_REQUEST_BYTES
  )
    throw new Error("照片数据过大，请移除或更换照片后重试。");
  return result;
}
