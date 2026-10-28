'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, UploadCloud, X } from 'lucide-react';
import clsx from 'clsx';
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, isUploadPath, megabytes, type UploadKind } from '@/lib/upload-fields';

/**
 * Drop a file or click to pick one. Uploads immediately to /api/uploads and calls onChange with the
 * resulting path (/u/<id>.png) or the URL the person typed. The field also accepts a typed https URL as
 * before, for images already hosted elsewhere.
 *
 * The component owns no state beyond the in-progress upload; the parent drives the current value.
 */
export function ImagePicker({
  kind,
  value,
  onChange,
  placeholder,
  urlInputClass,
}: {
  kind: UploadKind;
  /** The current field value: either a /u/… path from a previous upload, or an https URL, or ''. */
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  urlInputClass?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const limit = MAX_UPLOAD_BYTES[kind];
  const isOwn = isUploadPath(value);

  async function handleFile(file: File) {
    setUploadError('');
    if (file.size > limit) {
      setUploadError(`That image is too big - the limit is ${megabytes(limit)}.`);
      return;
    }
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    body.append('kind', kind);
    const res = await fetch('/api/uploads', { method: 'POST', body }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setUploading(false);
    if (!res?.ok) {
      setUploadError(out.error || 'Upload failed. Try again.');
      return;
    }
    onChange(out.url as string);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-2">
      {/* Drop zone - shown when there's no image set yet, or while uploading */}
      {(!value || uploading) && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={clsx(
            'flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 text-sm transition-colors',
            dragging ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-3 hover:border-line-strong hover:text-ink',
            uploading && 'cursor-default opacity-70',
          )}
        >
          {uploading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <UploadCloud size={20} />
          )}
          <span>{uploading ? 'Uploading…' : 'Drop an image here, or click to pick one'}</span>
          <span className="text-[12px] text-ink-3">PNG, JPG, WebP or GIF · max {megabytes(limit)}</span>
        </button>
      )}

      {/* Thumbnail + clear - shown when an upload path is set */}
      {value && isOwn && !uploading && (
        <div className="group relative overflow-hidden rounded-xl border border-line bg-raised">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-28 w-full object-cover" />
          <div className="absolute inset-0 flex items-start justify-end gap-1.5 p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title="Replace image"
              onClick={() => inputRef.current?.click()}
              className="btn btn-ghost btn-sm rounded-lg bg-bg/80 text-ink hover:bg-bg"
            >
              <ImagePlus size={14} /> Replace
            </button>
            <button
              type="button"
              title="Remove image"
              onClick={() => onChange('')}
              className="btn btn-ghost btn-sm rounded-lg bg-bg/80 text-danger hover:bg-bg"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* URL input - always shown so people can still paste a link, unless they've uploaded something */}
      {!isOwn && (
        <div className="flex gap-2">
          <input
            className={clsx('field h-10 font-mono text-[13px]', urlInputClass)}
            value={value}
            onChange={(e) => { setUploadError(''); onChange(e.target.value); }}
            placeholder={placeholder ?? 'https://…/image.png'}
            inputMode="url"
          />
          {value && (
            <button type="button" onClick={() => onChange('')} className="btn btn-ghost btn-sm shrink-0 text-ink-3 hover:text-danger" aria-label="Clear">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}

      {uploadError && <p className="text-[13px] text-danger">{uploadError}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

/**
 * A single screenshot row: thumbnail (if uploaded) or URL field, with a remove button.
 * Passed the index so the parent can splice out the right item.
 */
export function ScreenshotPickerRow({
  url,
  index,
  onRemove,
  onUpload,
  onUrlChange,
}: {
  url: string;
  index: number;
  onRemove: () => void;
  onUpload: (url: string) => void;
  onUrlChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isOwn = isUploadPath(url);
  const limit = MAX_UPLOAD_BYTES.screenshot;

  async function handleFile(file: File) {
    setUploadError('');
    if (file.size > limit) { setUploadError(`Too big - max ${megabytes(limit)}.`); return; }
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    body.append('kind', 'screenshot');
    const res = await fetch('/api/uploads', { method: 'POST', body }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setUploading(false);
    if (!res?.ok) { setUploadError(out.error || 'Upload failed.'); return; }
    onUpload(out.url as string);
  }

  return (
    <div className="rounded-xl border border-line p-2">
      {uploading && (
        <div className="flex h-10 items-center justify-center gap-2 text-[13px] text-ink-3">
          <Loader2 size={14} className="animate-spin" />
          Uploading…
        </div>
      )}
      {!uploading && isOwn ? (
        <div className="group relative overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Screenshot ${index + 1}`} className="h-24 w-full object-cover" />
          <div className="absolute inset-0 flex items-start justify-end gap-1.5 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-ghost btn-sm rounded-lg bg-bg/80 text-ink hover:bg-bg text-xs">
              <ImagePlus size={12} /> Replace
            </button>
            <button type="button" onClick={onRemove} className="btn btn-ghost btn-sm rounded-lg bg-bg/80 text-danger hover:bg-bg" aria-label="Remove">
              <X size={12} />
            </button>
          </div>
        </div>
      ) : !uploading ? (
        <div className="flex gap-2">
          <button
            type="button"
            title="Upload an image"
            onClick={() => inputRef.current?.click()}
            className="btn btn-ghost btn-sm shrink-0 text-ink-3 hover:text-ink"
          >
            <UploadCloud size={15} />
          </button>
          <input
            className="field h-10 font-mono text-[13px]"
            value={url}
            onChange={(e) => { setUploadError(''); onUrlChange(e.target.value); }}
            placeholder="https://…/screenshot.png"
            inputMode="url"
          />
          <button type="button" onClick={onRemove} className="btn btn-ghost btn-sm shrink-0 text-ink-3 hover:text-danger" aria-label="Remove">
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}
      {uploadError && <p className="mt-1 text-[12px] text-danger">{uploadError}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}
