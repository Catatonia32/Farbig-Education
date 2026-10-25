import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  downloadStoredFile,
  PASSPORT_FOLDER,
  PROOF_FOLDER,
} from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  // Nama file diambil dari segmen terakhir URL.
  const lastSegment =
    new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "";

  let filename = "";

  try {
    filename = decodeURIComponent(lastSegment);
  } catch {
    filename = "";
  }

  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  const contentType = CONTENT_TYPES[ext];

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Nama file tidak valid." },
      { status: 400 },
    );
  }

  // Cari di folder bukti, folder paspor, lalu root (untuk data lama).
  const file = await downloadStoredFile(supabaseAdmin, filename, [
    PROOF_FOLDER,
    PASSPORT_FOLDER,
    "",
  ]);

  if (!file) {
    return NextResponse.json(
      { error: "File tidak ditemukan." },
      { status: 404 },
    );
  }

  const bytes = await file.blob.arrayBuffer();

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
