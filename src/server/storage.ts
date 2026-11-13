import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { integrations } from "./env";
import { DomainError } from "./services/common";

const MAX_BYTES = 5 * 1024 * 1024;
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

function sniff(buf: Buffer): { ext: string; type: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

/** Validates (by content, not just extension) and stores an image. Returns a public URL. */
export async function uploadImage(file: File, folder: "logos" | "covers" | "deals"): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new DomainError("invalid", "Choose an image to upload.");
  if (file.size > MAX_BYTES) throw new DomainError("too_large", "Images must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw new DomainError("invalid_type", "Upload a JPG, PNG or WebP image.");
  const name = `${randomUUID()}.${kind.ext}`;

  if (integrations.supabase) {
    const { supabaseAdmin } = await import("./supabase");
    const sb = supabaseAdmin();
    const key = `${folder}/${name}`;
    const { error } = await sb.storage.from("media").upload(key, buf, { contentType: kind.type, cacheControl: "31536000" });
    if (error) throw new DomainError("upload_failed", "Upload failed. Please try again.");
    return sb.storage.from("media").getPublicUrl(key).data.publicUrl;
  }

  const dir = path.join(LOCAL_UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/api/uploads/${folder}/${name}`;
}
