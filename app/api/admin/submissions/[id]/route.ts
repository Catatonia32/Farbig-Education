import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

const allowedStatuses = ["pending", "verified", "rejected"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        { error: "Tidak memiliki akses admin." },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return NextResponse.json(
        { error: "ID pembayaran tidak valid." },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (
      typeof body.status !== "string" ||
      !allowedStatuses.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "Status pembayaran tidak valid." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("payment_submissions")
      .update({ status: body.status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Supabase PATCH:", error.message);
      return NextResponse.json(
        { error: "Gagal memperbarui pembayaran." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Data pembayaran tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}
