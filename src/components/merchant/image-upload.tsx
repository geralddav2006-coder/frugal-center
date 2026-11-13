"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImageAction } from "@/app/actions/merchant";
import { SmartImage } from "@/components/smart-image";
import { cn } from "@/lib/utils";

async function upload(file: File, folder: "logos" | "covers" | "deals") {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("folder", folder);
  const res = await uploadImageAction(fd);
  if (!res.ok) throw new Error(res.error);
  return res.url;
}

export function SingleImageUpload({
  value,
  onChange,
  folder,
  label,
  aspect = "aspect-[16/9]",
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "logos" | "covers";
  label: string;
  aspect?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={className}>
      <div className={cn("relative overflow-hidden rounded-2xl border border-dashed border-line bg-paper", aspect)}>
        {value ? (
          <>
            <SmartImage src={value} alt={label} sizes="400px" />
            <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${label}`} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white shadow"><X className="size-4" /></button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {busy ? "Uploading…" : `Upload ${label.toLowerCase()}`}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={`Upload ${label}`}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onChange(await upload(file, folder));
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function MultiImageUpload({ value, onChange, max = 6 }: { value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {value.map((url, i) => (
        <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-mist">
          <SmartImage src={url} alt={`Deal photo ${i + 1}`} sizes="160px" />
          {i === 0 ? <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span> : null}
          <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} aria-label={`Remove photo ${i + 1}`} className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white shadow"><X className="size-3.5" /></button>
        </div>
      ))}
      {value.length < max ? (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-paper text-xs font-semibold text-muted hover:border-ink hover:text-ink">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? "Uploading" : "Add photo"}
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Upload deal photos"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])].slice(0, max - value.length);
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          const urls = [...value];
          for (const f of files) {
            try {
              urls.push(await upload(f, "deals"));
            } catch (err) {
              toast.error((err as Error).message);
            }
          }
          onChange(urls);
          setBusy(false);
        }}
      />
    </div>
  );
}
