import { t } from "./i18n/ja";
import { imageRepository } from "./local/repository/imageRepository";

export async function thumbnail(
  file: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  async function decode(source: Blob): Promise<{
    image: CanvasImageSource;
    width: number;
    height: number;
    release: () => void;
  }> {
    try {
      const bitmap = await createImageBitmap(source);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      const url = URL.createObjectURL(source),
        image = new Image();
      try {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(t("images_128")));
          image.src = url;
        });
        return {
          image,
          width: image.naturalWidth,
          height: image.naturalHeight,
          release: () => URL.revokeObjectURL(url),
        };
      } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    }
  }
  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/png" });
    decoded = await decode(Array.isArray(converted) ? converted[0] : converted);
  }
  const { width, height } = decoded,
    scale = Math.min(1, 768 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  try {
    canvas
      .getContext("2d")!
      .drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
  } finally {
    decoded.release();
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(t("images_129")))),
      "image/webp",
      0.82,
    ),
  );
  return { blob, width, height };
}
export const uploadImage = (card: string, file: File) =>
  imageRepository.import(card, file);
