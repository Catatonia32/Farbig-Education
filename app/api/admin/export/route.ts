import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  verified: "Terverifikasi",
  rejected: "Ditolak",
};

function formatDateTime(value: unknown) {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value ?? "");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(", ", " ");
}

function formatDate(value: unknown) {
  const [y, m, d] = String(value ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(value ?? "");
}

// Teks biasa: dikutip, dan dicegah dibaca Excel sebagai rumus
function text(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// Angka panjang (nomor HP) dipaksa tampil utuh, bukan 1,23E+11
function textAsIs(value: unknown) {
  const s = String(value ?? "").replace(/"/g, "");
  return `="${s}"`;
}

const columns: { header: string; cell: (r: Row) => string }[] = [
  {
    header: "No. Referensi",
    cell: (r) => text(`FARBIG-${String(r.id).padStart(6, "0")}`),
  },
  { header: "Tanggal Masuk", cell: (r) => text(formatDateTime(r.created_at)) },
  { header: "Nama Peserta", cell: (r) => text(r.student_name) },
  { header: "Asal Sekolah", cell: (r) => text(r.school) },
  { header: "Orang Tua / Wali", cell: (r) => text(r.parent_name) },
  { header: "Nomor WhatsApp", cell: (r) => textAsIs(r.phone) },
  { header: "Program", cell: (r) => text(r.destination) },
  { header: "Jenis Pembayaran", cell: (r) => text(r.payment_type) },
  {
    header: "Tanggal Pembayaran",
    cell: (r) => text(formatDate(r.payment_date)),
  },
  { header: "Nominal (Rp)", cell: (r) => String(Number(r.amount_paid) || 0) },
  { header: "Metode Pembayaran", cell: (r) => text(r.payment_method) },
  { header: "Nama Pengirim / Berita", cell: (r) => text(r.transfer_note) },
  { header: "Catatan", cell: (r) => text(r.notes) },
  {
    header: "Status",
    cell: (r) => text(STATUS_LABEL[String(r.status)] ?? r.status),
  },
  { header: "File Bukti", cell: (r) => text(r.proof_file) },
];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.authorized) return admin.response;

  const { data, error } = await supabaseAdmin
    .from("payment_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const lines = [
    "sep=;",
    columns.map((c) => text(c.header)).join(";"),
    ...rows.map((row) => columns.map((c) => c.cell(row)).join(";")),
  ];

  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="respons-pembayaran.csv"',
    },
  });
}
