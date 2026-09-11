import sharp from "sharp";
import { TARGET_IMAGE_RAW_BYTES } from "@/lib/uploads";
import type { NoteImageMediaType } from "@/lib/anthropic";

export interface CompressedImage {
  buffer: Buffer;
  mediaType: NoteImageMediaType;
}

/**
 * Returns the image as-is if it's already small enough for Claude's
 * base64-encoded size limit. Otherwise re-encodes it as JPEG, stepping
 * quality down first (preserves resolution - important for reading
 * handwriting/text in a photographed note) and shrinking dimensions only if
 * quality reduction alone isn't enough.
 */
export async function compressImageToFit(buffer: Buffer): Promise<CompressedImage> {
  if (buffer.length <= TARGET_IMAGE_RAW_BYTES) {
    // Re-encoding an already-small image would just spend time for no
    // benefit - the caller still needs a mediaType, so the original format
    // is preserved by the caller in that case; this function is only
    // reached when compression is actually needed. See extract/route.ts.
    return { buffer, mediaType: "image/jpeg" };
  }

  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  let width = metadata.width;

  let quality = 85;
  let out = await sharp(buffer, { failOn: "none" }).rotate().jpeg({ quality }).toBuffer();

  while (out.length > TARGET_IMAGE_RAW_BYTES && quality > 30) {
    quality -= 15;
    out = await sharp(buffer, { failOn: "none" }).rotate().jpeg({ quality }).toBuffer();
  }

  while (out.length > TARGET_IMAGE_RAW_BYTES && width && width > 600) {
    width = Math.round(width * 0.75);
    out = await sharp(buffer, { failOn: "none" }).rotate().resize({ width }).jpeg({ quality: 70 }).toBuffer();
  }

  return { buffer: out, mediaType: "image/jpeg" };
}
