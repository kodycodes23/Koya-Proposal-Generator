import { NextRequest, NextResponse } from "next/server";
import { extractIntakeFromNotes, type NoteAttachment, type NoteImageMediaType } from "@/lib/anthropic";
import { compressImageToFit } from "@/lib/images";
import { MAX_FILES, TARGET_IMAGE_RAW_BYTES, maxUploadBytesFor } from "@/lib/uploads";

const IMAGE_TYPES: NoteImageMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const TEXT_TYPES = ["text/plain", "text/markdown"];

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const typedNotes = (formData.get("notes_text") as string) || "";
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0 && !typedNotes.trim()) {
    return NextResponse.json({ error: "Attach at least one file or type some notes first" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Attach at most ${MAX_FILES} files at a time` }, { status: 400 });
  }

  const attachments: NoteAttachment[] = [];
  for (const file of files) {
    const mediaType = file.type;
    const uploadLimit = maxUploadBytesFor(mediaType);
    if (file.size > uploadLimit) {
      return NextResponse.json(
        { error: `"${file.name}" is ${formatMB(file.size)}, too large - please attach something under ${formatMB(uploadLimit)}.` },
        { status: 400 }
      );
    }

    if ((IMAGE_TYPES as string[]).includes(mediaType)) {
      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      let finalMediaType = mediaType as NoteImageMediaType;

      if (buffer.length > TARGET_IMAGE_RAW_BYTES) {
        const compressed = await compressImageToFit(buffer);
        buffer = compressed.buffer;
        finalMediaType = compressed.mediaType;
      }

      attachments.push({ kind: "image", mediaType: finalMediaType, base64: buffer.toString("base64"), filename: file.name });
    } else if (mediaType === "application/pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({ kind: "pdf", base64: buffer.toString("base64"), filename: file.name });
    } else if (TEXT_TYPES.includes(mediaType) || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
      attachments.push({ kind: "text", text, filename: file.name });
    } else {
      return NextResponse.json(
        { error: `"${file.name}" isn't a supported type. Use images (JPG/PNG/GIF/WebP), PDF, or plain text/markdown.` },
        { status: 400 }
      );
    }
  }

  try {
    const extracted = await extractIntakeFromNotes(attachments, typedNotes);
    return NextResponse.json(extracted);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read the attached notes";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
