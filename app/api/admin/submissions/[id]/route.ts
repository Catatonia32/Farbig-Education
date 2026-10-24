import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendVerificationEmail } from "@/lib/email/send-verification";

export const runtime = "nodejs";

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

    const body = await request.json().catch(() => null);

    if (
      !body ||
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
      .select("*")
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

    // Kirim email hanya saat diverifikasi dan belum pernah terkirim.
    let emailSent = false;
    let emailError: string | null = null;

    if (body.status === "verified" && !data.email_sent_at) {
      if (!data.email) {
        emailError =
          "Status tersimpan, tetapi peserta ini tidak punya alamat email sehingga email tidak dikirim.";
      } else {
        try {
          await sendVerificationEmail(data);

          const { error: markError } = await supabaseAdmin
            .from("payment_submissions")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", id);

          if (markError) {
            console.error(
              "[verify-email] Gagal menandai email:",
              markError.message,
            );
          }

          emailSent = true;
        } catch (err) {
          console.error("[verify-email] Gagal mengirim email:", err);
          emailError =
            "Status tersimpan, tetapi email gagal dikirim. Periksa terminal.";
        }
      }
    }

    return NextResponse.json({
      item: { id: data.id, status: data.status },
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error("PATCH submissions:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}
