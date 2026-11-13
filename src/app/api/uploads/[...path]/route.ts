import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { LOCAL_UPLOAD_DIR } from "@/server/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Local-demo image serving (production uses Supabase Storage public URLs). */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.length !== 2 || !["logos", "covers", "deals"].includes(parts[0]!) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(parts[1]!)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const file = await readFile(path.join(LOCAL_UPLOAD_DIR, parts[0]!, parts[1]!));
    return new NextResponse(file, {
      headers: { "Content-Type": TYPES[parts[1]!.split(".").pop()!]!, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
