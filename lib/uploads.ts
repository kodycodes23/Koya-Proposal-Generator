// Shared between the client (app/new/page.tsx) and the extraction API route,
// so the limits a user sees before attaching match what the server actually
// enforces.

// Claude's image content blocks have a hard 10 MiB (10,485,760 byte) cap on
// the *base64-encoded* size, and base64 inflates raw bytes by ~4/3. Images
// under this raw-byte target are sent as-is; anything larger gets
// auto-compressed server-side to fit (see lib/images.ts), rather than being
// rejected outright - a 5% margin below the exact 3/4 ceiling covers base64
// padding/rounding.
export const CLAUDE_IMAGE_BASE64_LIMIT = 10 * 1024 * 1024;
export const TARGET_IMAGE_RAW_BYTES = Math.floor(CLAUDE_IMAGE_BASE64_LIMIT * (3 / 4) * 0.95);

// A sanity ceiling on the *raw upload* itself, independent of Claude's
// limit - images past this are auto-compressed anyway, but an unbounded
// upload (a 300MB image) would still be an expensive, memory-hungry thing to
// process, so reject those outright instead of trying to shrink them.
export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

export const MAX_OTHER_FILE_BYTES = 10 * 1024 * 1024;

export const MAX_FILES = 8;

export const ACCEPTED_FILE_TYPES = "image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown";

export function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}

export function maxUploadBytesFor(mediaType: string): number {
  return isImageMediaType(mediaType) ? MAX_IMAGE_UPLOAD_BYTES : MAX_OTHER_FILE_BYTES;
}
