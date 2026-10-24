import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "payment-proofs";

type Submission = {
  id: number;
  email: string;
  parent_name: string;
  student_name: string;
  destination: string;
  payment_type: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  proof_file: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export async function sendVerificationEmail(s: Submission) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY atau MAIL_FROM belum diatur.");
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(s.proof_file);

  if (downloadError || !file) {
    throw new Error(
      `Bukti pembayaran tidak dapat diambil: ${downloadError?.message ?? "file kosong"}`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ref = `FARBIG-${String(s.id).padStart(6, "0")}`;
  const ext = s.proof_file.includes(".")
    ? s.proof_file.slice(s.proof_file.lastIndexOf("."))
    : "";

  const rows: [string, string][] = [
    ["Nomor referensi", ref],
    ["Nama peserta", s.student_name],
    ["Program", s.destination],
    ["Jenis pembayaran", s.payment_type],
    ["Tanggal pembayaran", s.payment_date],
    ["Nominal", money(s.amount_paid)],
    ["Metode pembayaran", s.payment_method],
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a2e28">
      <h2 style="margin-bottom:4px">Pembayaran Anda telah diverifikasi</h2>
      <p>Yth. ${escapeHtml(s.parent_name)}, tim Farbig telah memeriksa dan memverifikasi konfirmasi pembayaran berikut:</p>
      <table style="width:100%;border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5ece9;color:#6b7d77;width:45%">${label}</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5ece9;font-weight:bold">${escapeHtml(value)}</td>
          </tr>`,
          )
          .join("")}
      </table>
      <p>Salinan bukti pembayaran terlampir pada email ini.</p>
      <p style="color:#6b7d77;font-size:13px">Farbig International Education</p>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: s.email,
    subject: `Pembayaran terverifikasi · ${ref}`,
    html,
    attachments: [
      { filename: `bukti-pembayaran-${ref}${ext}`, content: buffer },
    ],
  });

  if (error) throw new Error(error.message);
}
