import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BUCKET = "payment-proofs";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const allowedPrograms = new Set([
  "Singapore–Malaysia 6 Hari",
  "Japan Mono Tokyo 8 Hari",
  "China Beijing 7 Hari",
  "Mesir–Israel 14 Hari",
  "Program lainnya",
]);

const allowedPaymentTypes = [
  "Pelunasan",
  "Uang muka (DP)",
  "Pembayaran tambahan",
];

const allowedPaymentMethods = [
  "Transfer bank",
  "Virtual account",
  "Tunai",
  "Lainnya",
];

const clean = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

function jsonError(error: string, status = 400) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function createSupabaseAdmin() {
  // Mendukung URL dengan nama variabel baru maupun lama.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Gunakan secret key server, bukan publishable key.
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap. Pastikan SUPABASE_URL dan SUPABASE_SECRET_KEY tersedia.",
    );
  }

  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY berisi publishable key. Gunakan secret key server dari Supabase Dashboard.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);

  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= today
  );
}

function validFileSignature(bytes: Buffer, ext: string) {
  if (ext === ".jpg") {
    return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }

  if (ext === ".png") {
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (ext === ".webp") {
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  }

  if (ext === ".pdf") {
    return bytes.toString("ascii", 0, 5) === "%PDF-";
  }

  return false;
}

export async function POST(request: Request) {
  let supabaseAdmin: ReturnType<typeof createSupabaseAdmin> | null = null;

  let uploadedPath: string | null = null;

  try {
    const supabase = createSupabaseAdmin();
    supabaseAdmin = supabase;

    const form = await request.formData();

    const parentName = clean(form.get("parentName"));
    const phone = clean(form.get("phone"));
    const email = clean(form.get("email")).toLowerCase();
    const studentName = clean(form.get("studentName"));
    const school = clean(form.get("school"));
    const destination = clean(form.get("destination"));
    const paymentType = clean(form.get("paymentType"));
    const paymentDate = clean(form.get("paymentDate"));
    const amountString = clean(form.get("amountPaid"));
    const paymentMethod = clean(form.get("paymentMethod"));
    const transferNote = clean(form.get("transferNote"));
    const notes = clean(form.get("notes"));
    const consent = form.get("consent") === "on";
    const file = form.get("proof");

    // Validasi kolom wajib.
    if (
      ![
        parentName,
        phone,
        email,
        studentName,
        school,
        destination,
        paymentType,
        paymentDate,
        amountString,
        paymentMethod,
      ].every(Boolean)
    ) {
      return jsonError("Mohon lengkapi semua kolom wajib diisi.");
    }

    if (
      parentName.length > 120 ||
      studentName.length > 120 ||
      school.length > 160 ||
      phone.length > 30 ||
      email.length > 160 ||
      transferNote.length > 200 ||
      notes.length > 1000
    ) {
      return jsonError("Ada isian yang melebihi batas karakter.");
    }

    if (!/^\+?[0-9\s().-]{8,30}$/.test(phone)) {
      return jsonError(
        "Nomor WhatsApp tidak valid. Periksa kembali nomor yang dimasukkan.",
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return jsonError("Alamat email tidak valid.");
    }

    if (!allowedPrograms.has(destination)) {
      return jsonError("Pilihan program tidak valid.");
    }

    if (!allowedPaymentTypes.includes(paymentType)) {
      return jsonError("Jenis pembayaran tidak valid.");
    }

    if (!validDate(paymentDate)) {
      return jsonError("Tanggal pembayaran tidak valid.");
    }

    const amountDigits = amountString.replace(/\D/g, "");
    const amountPaid = Number(amountDigits);

    if (
      !amountDigits ||
      !Number.isSafeInteger(amountPaid) ||
      amountPaid < 1 ||
      amountPaid > 10_000_000_000
    ) {
      return jsonError("Nominal pembayaran harus berupa angka yang valid.");
    }

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return jsonError("Metode pembayaran tidak valid.");
    }

    if (!consent) {
      return jsonError("Persetujuan penggunaan data wajib dicentang.");
    }

    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Bukti pembayaran wajib diunggah.");
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError("Ukuran bukti pembayaran maksimal 5 MB.");
    }

    const ext = MIME_EXT[file.type];

    if (!ext) {
      return jsonError("Format bukti harus JPG, PNG, WEBP, atau PDF.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (!validFileSignature(bytes, ext)) {
      return jsonError("Isi file tidak cocok dengan format yang dipilih.");
    }

    // Upload bukti ke Storage privat.
    const filename = `${randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[submissions] Storage upload gagal:", uploadError.message);

      return jsonError(
        "Bukti pembayaran gagal disimpan. Periksa bucket payment-proofs dan secret key Supabase.",
        500,
      );
    }

    uploadedPath = filename;

    // Simpan data formulir ke PostgreSQL.
    const { data: inserted, error: insertError } = await supabase
      .from("payment_submissions")
      .insert({
        parent_name: parentName,
        phone,
        email,
        student_name: studentName,
        school,
        destination,
        payment_type: paymentType,
        payment_date: paymentDate,
        amount_paid: amountPaid,
        payment_method: paymentMethod,
        transfer_note: transferNote || null,
        notes: notes || null,
        proof_file: filename,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(
        "[submissions] Database insert gagal:",
        insertError.message,
      );

      // Bersihkan bukti jika penyimpanan database gagal.
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove([filename]);

      if (cleanupError) {
        console.error(
          "[submissions] Gagal membersihkan file:",
          cleanupError.message,
        );
      }

      uploadedPath = null;

      return jsonError(
        "Data pembayaran gagal disimpan. Periksa tabel payment_submissions dan kolomnya.",
        500,
      );
    }

    uploadedPath = null;

    return NextResponse.json(
      {
        ok: true,
        id: Number(inserted.id),
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    // Catat detail di terminal, bukan membocorkan rahasia ke browser.
    console.error("[submissions] Server error:", error);

    if (uploadedPath && supabaseAdmin) {
      try {
        const { error: cleanupError } = await supabaseAdmin.storage
          .from(BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error(
            "[submissions] Gagal membersihkan file:",
            cleanupError.message,
          );
        }
      } catch (cleanupError) {
        console.error("[submissions] Cleanup exception:", cleanupError);
      }
    }

    return jsonError(
      "Terjadi kesalahan pada server. Periksa terminal Next.js untuk detailnya.",
      500,
    );
  }
}
