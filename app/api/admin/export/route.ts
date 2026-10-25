import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  verified: "Terverifikasi",
  rejected: "Ditolak",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "FFFFF3D6", fg: "FF8A5A00" },
  verified: { bg: "FFDCEFE3", fg: "FF1B5E3B" },
  rejected: { bg: "FFFBE0E0", fg: "FF9B2C2C" },
};

const BRAND = "FF1A4D3E";
const BORDER = { style: "thin" as const, color: { argb: "FFD9E2DE" } };
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Tanggal + jam sebagai tanggal asli Excel, digeser ke WIB.
function toWibDateTime(value: unknown): Date | string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return String(value ?? "");
  return new Date(d.getTime() + WIB_OFFSET_MS);
}

// "YYYY-MM-DD" sebagai tanggal asli Excel.
function toDateOnly(value: unknown): Date | string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match) return String(value ?? "");
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

const str = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.authorized) return admin.response;

  const { data, error } = await supabaseAdmin
    .from("payment_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[export] Supabase:", error.message);
    return NextResponse.json(
      { error: "Gagal mengambil data untuk diekspor." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Row[];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Farbig International Education";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Respons Pembayaran", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "No. Referensi", key: "ref", width: 17 },
    { header: "Tanggal Masuk", key: "created", width: 18 },
    { header: "Nama Peserta", key: "student", width: 28 },
    { header: "Asal Sekolah", key: "school", width: 32 },
    { header: "Orang Tua / Wali", key: "parent", width: 26 },
    { header: "Nomor WhatsApp", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 32 },
    { header: "Program", key: "program", width: 28 },
    { header: "Jenis Pembayaran", key: "type", width: 20 },
    { header: "Tanggal Pembayaran", key: "paydate", width: 18 },
    { header: "Nominal", key: "amount", width: 18 },
    { header: "Metode Pembayaran", key: "method", width: 20 },
    { header: "Catatan", key: "notes", width: 36 },
    { header: "Status", key: "status", width: 16 },
    { header: "File Bukti", key: "proof", width: 42 },
  ];

  for (const r of rows) {
    sheet.addRow({
      ref: `FARBIG-${String(r.id).padStart(6, "0")}`,
      created: toWibDateTime(r.created_at),
      student: str(r.student_name),
      school: str(r.school),
      parent: str(r.parent_name),
      phone: str(r.phone),
      email: str(r.email),
      program: str(r.destination),
      type: str(r.payment_type),
      paydate: toDateOnly(r.payment_date),
      amount: Number(r.amount_paid) || 0,
      method: str(r.payment_method),
      notes: str(r.notes),
      status: STATUS_LABEL[str(r.status)] ?? str(r.status),
      proof: str(r.proof_file),
    });
  }

  // Format kolom
  sheet.getColumn("created").numFmt = "dd/mm/yyyy hh:mm";
  sheet.getColumn("paydate").numFmt = "dd/mm/yyyy";
  sheet.getColumn("amount").numFmt = '"Rp" #,##0';
  sheet.getColumn("phone").numFmt = "@"; // nomor tetap utuh, bukan 1,23E+11

  // Header
  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  });

  // Isi data
  const statusColIndex = sheet.getColumn("status").number;
  const amountColIndex = sheet.getColumn("amount").number;

  for (let i = 2; i <= rows.length + 1; i++) {
    const row = sheet.getRow(i);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: BORDER,
        left: BORDER,
        bottom: BORDER,
        right: BORDER,
      };
    });

    row.getCell(amountColIndex).alignment = {
      vertical: "top",
      horizontal: "right",
    };

    const raw = str(rows[i - 2].status);
    const style = STATUS_STYLE[raw];
    if (style) {
      const cell = row.getCell(statusColIndex);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: style.bg },
      };
      cell.font = { bold: true, color: { argb: style.fg } };
      cell.alignment = { vertical: "top", horizontal: "center" };
    }
  }

  // Baris total (ikut berubah saat data difilter di Excel)
  if (rows.length > 0) {
    const totalRowIndex = rows.length + 2;
    const amountLetter = sheet.getColumn("amount").letter;
    const totalRow = sheet.getRow(totalRowIndex);

    // Label diletakkan di kolom tepat di kiri nominal.
    const labelColIndex = amountColIndex - 1;

    totalRow.getCell(labelColIndex).value = "TOTAL";
    totalRow.getCell(amountColIndex).value = {
      formula: `SUBTOTAL(109,${amountLetter}2:${amountLetter}${rows.length + 1})`,
    };

    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > sheet.columnCount) return;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F3" },
      };
      cell.border = { top: { style: "medium", color: { argb: BRAND } } };
    });
    totalRow.getCell(labelColIndex).alignment = { horizontal: "right" };
    totalRow.getCell(amountColIndex).numFmt = '"Rp" #,##0';
    totalRow.getCell(amountColIndex).alignment = { horizontal: "right" };
  }

  // Filter di header
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: sheet.columnCount },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="respons-pembayaran-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
