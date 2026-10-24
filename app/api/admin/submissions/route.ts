import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Periksa sesi admin terlebih dahulu.
    const auth = await requireAdmin();

    if (!auth.authorized) {
      return auth.response;
    }

    // Ambil data pembayaran dari Supabase.
    const { data, error } = await supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase GET:", error.message);

      return NextResponse.json(
        { error: "Gagal mengambil data pembayaran." },
        { status: 500 },
      );
    }

    const items = (data ?? []).map((item) => ({
      ...item,
      amount_paid: Number(item.amount_paid),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Admin submissions:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}
