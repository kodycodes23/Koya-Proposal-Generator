"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PaperclipIcon, SparkleIcon } from "@/components/icons";
import type { ExtractedIntake } from "@/lib/anthropic";
import { ACCEPTED_FILE_TYPES, isImageMediaType, maxUploadBytesFor } from "@/lib/uploads";

const TEXT_FIELDS: { key: string; label: string; type?: string; required?: boolean }[] = [
  { key: "client_name", label: "Client Name", required: true },
  { key: "client_email", label: "Client Email", type: "email", required: true },
  { key: "company_name", label: "Company Name", required: true },
  { key: "date_of_call", label: "Date of Call", type: "date" },
  { key: "salesperson_name", label: "Salesperson Name", required: true },
];

const TEXTAREA_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "client_needs_summary", label: "Summary of Client's Needs", hint: "The problem the client wants to solve." },
  { key: "project_scope", label: "Project Scope", hint: "What the client wants built or delivered." },
  { key: "goals_and_objectives", label: "Goals and Objectives", hint: "Outcomes the client wants (revenue growth, efficiency, etc)." },
  { key: "recommended_services", label: "Recommended Services or Deliverables", hint: "Proposed services, outputs, or deliverables." },
  { key: "proposed_timeline", label: "Proposed Timeline", hint: "Expected duration, phases, or delivery window." },
  { key: "estimated_pricing", label: "Estimated Pricing", hint: "Proposed price, range, or pricing notes." },
];

const IDENTITY_KEYS = ["client_name", "client_email", "company_name", "date_of_call"] as const;
const CONTENT_KEYS = [
  "client_needs_summary",
  "project_scope",
  "goals_and_objectives",
  "recommended_services",
  "proposed_timeline",
  "estimated_pricing",
] as const;

const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  [...TEXT_FIELDS, ...TEXTAREA_FIELDS].map((f) => [f.key, f.label])
);

const inputClass =
  "w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Attachment {
  file: File;
  previewUrl: string | null;
}

export default function NewProposalPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  // null = not uploading; 0-99 = real upload progress; 100 = upload done,
  // waiting on Claude (shown as an indeterminate bar, since there's no byte
  // count for "the model is thinking").
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSummary, setExtractSummary] = useState<{ updated: string[]; notFound: string[] } | null>(null);

  // Revoke every preview URL on unmount so we don't leak blob URLs.
  useEffect(() => {
    return () => {
      for (const a of attachments) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addFiles(fileList: FileList | null) {
    // Snapshot the files into a plain array BEFORE touching the input's
    // value. Resetting `.value` clears the input's selection, and in some
    // browsers that also empties any FileList reference taken from it - so
    // resetting first silently drops the very files we just picked up.
    const incoming = fileList ? Array.from(fileList) : [];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (incoming.length === 0) return;

    // Reject anything past the sanity ceiling before it ever gets to the
    // server. Images under that ceiling but still too large for Claude's
    // own limit aren't rejected here - the server auto-compresses those.
    const tooLarge = incoming.filter((f) => f.size > maxUploadBytesFor(f.type));
    const sizedOk = incoming.filter((f) => f.size <= maxUploadBytesFor(f.type));

    setAttachments((prev) => {
      const isDuplicate = (a: File, b: File) => a.name === b.name && a.size === b.size;
      const additions = sizedOk.filter((f) => !prev.some((p) => isDuplicate(p.file, f)));
      const skipped = sizedOk.length - additions.length;

      if (tooLarge.length > 0) {
        const names = tooLarge
          .map((f) => `"${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)}MB, max ${(maxUploadBytesFor(f.type) / (1024 * 1024)).toFixed(0)}MB)`)
          .join(", ");
        setAttachNotice(`Too large, not attached: ${names}.`);
      } else if (additions.length === 0) {
        setAttachNotice(
          sizedOk.length === 1 ? `"${sizedOk[0].name}" is already attached.` : "Those files are already attached."
        );
      } else {
        setAttachNotice(
          `Attached ${additions.length} file${additions.length > 1 ? "s" : ""}` +
            (skipped > 0 ? ` (${skipped} already attached, skipped).` : ".")
        );
      }

      if (additions.length === 0) return prev;

      const newAttachments: Attachment[] = additions.map((file) => ({
        file,
        previewUrl: isImageMediaType(file.type) ? URL.createObjectURL(file) : null,
      }));
      return [...prev, ...newAttachments];
    });
  }

  function removeFile(index: number) {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
    setAttachNotice(null);
  }

  function clearAttachments() {
    setAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
  }

  function applyExtraction(extracted: ExtractedIntake) {
    const updated: string[] = [];
    const notFound: string[] = [];

    setForm((f) => {
      const next = { ...f };

      for (const key of IDENTITY_KEYS) {
        const value = extracted[key];
        if (!value) continue;
        if (!next[key]?.trim()) {
          next[key] = value;
          updated.push(FIELD_LABELS[key]);
        }
        // Already has a value (e.g. a name/email) - identity fields aren't
        // combinable text, so don't overwrite what's already there.
      }

      for (const key of CONTENT_KEYS) {
        const value = extracted[key];
        if (value) {
          next[key] = next[key]?.trim() ? `${next[key].trim()}\n\n${value}` : value;
          updated.push(FIELD_LABELS[key]);
        } else {
          notFound.push(FIELD_LABELS[key]);
        }
      }

      const transcription = extracted.transcription?.trim();
      if (transcription) {
        next.supporting_material = next.supporting_material?.trim()
          ? `${next.supporting_material.trim()}\n\n--- From attached notes ---\n\n${transcription}`
          : transcription;
      }

      return next;
    });

    setExtractSummary({ updated, notFound });
  }

  function handleExtract() {
    if (attachments.length === 0 && !(form.supporting_material || "").trim()) return;

    setExtracting(true);
    setUploadProgress(0);
    setExtractError(null);
    setExtractSummary(null);
    setAttachNotice(null);

    const fd = new FormData();
    for (const a of attachments) fd.append("files", a.file);
    fd.append("notes_text", form.supporting_material || "");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/intake/extract");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Cap the real progress at 99 - 100 is reserved for "response received".
        setUploadProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.upload.onload = () => setUploadProgress(100);

    xhr.onload = () => {
      setExtracting(false);
      setUploadProgress(null);
      let data: { error?: string } & Partial<ExtractedIntake> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic error below
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        setExtractError(data.error || "Failed to read the attached notes");
        return;
      }
      applyExtraction(data as ExtractedIntake);
      clearAttachments();
    };

    xhr.onerror = () => {
      setExtracting(false);
      setUploadProgress(null);
      setExtractError("Network error while uploading your notes - check your connection and try again.");
    };

    xhr.send(fd);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok && !data.id) {
        throw new Error(data.error || "Failed to create proposal");
      }
      if (!res.ok && data.id) {
        // Row was created but generation failed - still send them to the
        // workspace so they can see the failure and retry from there.
        router.push(`/proposals/${data.id}`);
        return;
      }
      router.push(`/proposals/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const allFields = [...TEXT_FIELDS, ...TEXTAREA_FIELDS];
  const filledCount = allFields.filter((f) => (form[f.key] || "").trim().length > 0).length;
  const canExtract = attachments.length > 0 || (form.supporting_material || "").trim().length > 0;

  return (
    <main className="mx-auto max-w-3xl w-full px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Proposal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fill in what you know from the discovery call, or attach your raw notes below and let Claude pull the
            details out for you.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
          {filledCount}/{allFields.length} filled
        </span>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 space-y-6">
        <div className="border-b border-black/[0.06] pb-6">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Supporting Material / Call Notes</label>
            <label
              htmlFor="notes-file-input"
              className="flex items-center gap-1.5 rounded-full border border-black/[0.08] px-3 py-1 text-xs font-medium text-gray-600 hover:bg-black/[0.03] cursor-pointer select-none"
            >
              <PaperclipIcon className="w-3.5 h-3.5" />
              Attach files
            </label>
            <input
              ref={fileInputRef}
              id="notes-file-input"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Paste raw notes, or attach photos of handwritten notes, scans, PDFs, or text files - messy is fine.
          </p>

          {attachNotice && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 mb-2" role="status">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              {attachNotice}
            </p>
          )}

          {attachments.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 mb-1.5">
                {attachments.length} file{attachments.length > 1 ? "s" : ""} attached
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-2 rounded-full bg-gray-100 pl-1.5 pr-2 py-1.5 text-xs text-gray-600"
                  >
                    {a.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it
                      <img src={a.previewUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-500 uppercase">
                        {a.file.name.split(".").pop()?.slice(0, 3) || "file"}
                      </span>
                    )}
                    <span className="max-w-[160px] truncate">{a.file.name}</span>
                    <span className="text-gray-400 shrink-0">· {formatBytes(a.file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-red-600 px-1"
                      aria-label={`Remove ${a.file.name}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={form.supporting_material || ""}
            onChange={(e) => update("supporting_material", e.target.value)}
            rows={6}
            placeholder="Paste notes here, or attach files above..."
            className={inputClass}
          />

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={handleExtract}
              disabled={!canExtract || extracting}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 text-white px-3.5 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-40"
            >
              <SparkleIcon className="w-3.5 h-3.5" />
              {extracting ? "Reading notes…" : "Extract Details from Notes"}
            </button>
            {!extracting && (
              <span className="text-xs text-gray-400">Fills in the fields below - review before generating.</span>
            )}
          </div>

          {extracting && (
            <div className="mt-2.5">
              <div className="relative h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                {uploadProgress !== null && uploadProgress < 100 ? (
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                ) : (
                  <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-indigo-600 animate-indeterminate" />
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {uploadProgress !== null && uploadProgress < 100
                  ? `Uploading… ${uploadProgress}%`
                  : "Reading your notes with Claude…"}
              </p>
            </div>
          )}

          {extractError && <p className="text-red-600 text-xs mt-2">{extractError}</p>}

          {extractSummary && (
            <div className="mt-2 rounded-xl bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-700">
              {extractSummary.updated.length > 0 && (
                <p>
                  <strong>Updated from your notes:</strong> {extractSummary.updated.join(", ")}
                </p>
              )}
              {extractSummary.notFound.length > 0 && (
                <p className="mt-1">
                  <strong>Not found - fill in manually:</strong> {extractSummary.notFound.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Client &amp; Deal</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1.5">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={f.type || "text"}
                  required={f.required}
                  value={form[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-black/[0.06] pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Proposal Content</h2>
          <div className="space-y-4">
            {TEXTAREA_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                <p className="text-xs text-gray-400 mb-1.5">{f.hint}</p>
                <textarea
                  value={form[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Generating…" : "Generate Proposal"}
        </button>
      </form>
    </main>
  );
}
