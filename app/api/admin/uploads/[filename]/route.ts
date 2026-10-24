import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = "payment-proofs";

const types: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

type RouteContext = {
  params: Promise<{ filename: string }>;
};

function createSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL atau SUPABASE_SECRET_KEY belum dikonfigurasi.",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    // Periksa autentikasi admin.
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
    }

    const { filename } = await context.params;

    // Validasi nama file agar tidak dapat mengakses path sembarangan.
    if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$/i.test(filename)) {
      return NextResponse.json({ error: "File tidak valid." }, { status: 400 });
    }

    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

    const supabase = createSupabaseAdmin();

    // Ambil file dari Supabase Storage, bukan dari folder lokal.
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filename);

    if (error || !data) {
      console.error("Gagal mengambil file dari Supabase Storage:", {
        filename,
        message: error?.message,
      });

      return NextResponse.json(
        { error: "File tidak ditemukan di Supabase Storage." },
        { status: 404 },
      );
    }

    const fileBuffer = await data.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": types[ext],
        "Content-Length": String(data.size),
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Kesalahan saat membuka bukti pembayaran:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil file." },
      { status: 500 },
    );
  }
}
