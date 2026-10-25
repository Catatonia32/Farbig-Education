"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

const programs = [
  "Singapore–Malaysia 6 Hari",
  "Japan Mono Tokyo 8 Hari",
  "China Beijing 7 Hari",
  "Mesir–Israel 14 Hari",
  "Program lainnya",
];

type SubmissionResponse = {
  ok?: boolean;
  id?: number;
  error?: string;
};

function formatRupiah(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PaymentForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);

  function handleProofChange(event: ChangeEvent<HTMLInputElement>) {
    setProofFile(event.target.files?.[0] ?? null);
  }

  function handlePassportChange(event: ChangeEvent<HTMLInputElement>) {
    setPassportFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");
    setBusy(true);

    // Simpan referensi form sebelum proses asynchronous.
    const form = event.currentTarget;

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        body: new FormData(form),
        cache: "no-store",
      });

      const responseText = await response.text();

      let result: SubmissionResponse | null = null;

      if (responseText.trim()) {
        try {
          const parsed: unknown = JSON.parse(responseText);

          if (
            parsed !== null &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            result = parsed as SubmissionResponse;
          }
        } catch {
          console.error("[PaymentForm] Respons bukan JSON valid:", {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get("content-type"),
            body: responseText.slice(0, 1000),
          });

          throw new Error(
            `Server mengembalikan respons yang tidak valid (HTTP ${response.status}). Periksa terminal Next.js.`,
          );
        }
      }

      if (!result) {
        console.error("[PaymentForm] Respons API kosong:", {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type"),
          body: JSON.stringify(responseText),
        });

        throw new Error(
          `Server tidak memberikan respons JSON yang valid (HTTP ${response.status}). Periksa terminal Next.js.`,
        );
      }

      if (!response.ok || result.ok !== true) {
        throw new Error(
          result.error ||
            `Pengiriman formulir gagal (HTTP ${response.status}). Silakan coba kembali.`,
        );
      }

      if (
        typeof result.id !== "number" ||
        !Number.isSafeInteger(result.id) ||
        result.id < 1
      ) {
        console.error("[PaymentForm] ID referensi tidak valid:", result);

        throw new Error(
          "Server merespons berhasil, tetapi nomor referensi tidak valid. Periksa database sebelum mengirim ulang.",
        );
      }

      // Tampilkan halaman sukses setelah server mengonfirmasi penyimpanan.
      setSuccessId(result.id);
      form.reset();
      setAmount("");
      setProofFile(null);
      setPassportFile(null);
    } catch (err) {
      console.error("[PaymentForm] Pengiriman formulir gagal:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (successId !== null) {
    return (
      <div className="success-state" role="status">
        <div className="success-mark">✓</div>

        <span className="eyebrow">FORMULIR TERKIRIM</span>

        <h2>Terima kasih.</h2>

        <p>
          Konfirmasi pembayaran berhasil direkam. Simpan nomor referensi di
          bawah ini untuk keperluan komunikasi dengan tim Farbig.
        </p>

        <div className="reference-box">
          <small>NOMOR REFERENSI</small>
          <strong>FARBIG-{String(successId).padStart(6, "0")}</strong>
        </div>

        <button
          type="button"
          className="button button-primary full-width"
          onClick={() => {
            setSuccessId(null);
            setError("");
          }}
        >
          Kirim konfirmasi lain <span>↗</span>
        </button>
      </div>
    );
  }

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <div>
          <span className="section-index">02 / FORMULIR</span>
          <h2>Detail pembayaran</h2>
        </div>

        <span className="required-note">
          <b>*</b> Wajib diisi
        </span>
      </div>

      <div className="form-section-title">
        <span>01</span>
        <strong>Informasi orang tua &amp; peserta</strong>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>
            Nama orang tua / wali <b>*</b>
          </span>
          <input
            name="parentName"
            autoComplete="name"
            required
            maxLength={120}
            placeholder="Nama lengkap orang tua"
          />
        </label>

        <label className="field">
          <span>
            Nomor WhatsApp <b>*</b>
          </span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={30}
            placeholder="Contoh: 081234567890"
          />
        </label>

        <label className="field">
          <span>
            Email <b>*</b>
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            placeholder="Untuk menerima bukti verifikasi"
          />
        </label>

        <label className="field">
          <span>
            Nama lengkap peserta <b>*</b>
          </span>
          <input
            name="studentName"
            required
            maxLength={120}
            placeholder="Sesuai nama di paspor"
          />
        </label>

        <label className="field">
          <span>
            Asal sekolah <b>*</b>
          </span>
          <input
            name="school"
            required
            maxLength={160}
            placeholder="Nama sekolah peserta"
          />
        </label>

        <label className="field field-full">
          <span>
            Program Study Overseas <b>*</b>
          </span>

          <select name="destination" required defaultValue="">
            <option value="" disabled>
              Pilih program yang diikuti
            </option>

            {programs.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-section-title section-spaced">
        <span>02</span>
        <strong>Rincian pembayaran</strong>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>
            Jenis pembayaran <b>*</b>
          </span>

          <select name="paymentType" required defaultValue="Pelunasan">
            <option>Pelunasan</option>
            <option>Uang muka (DP)</option>
            <option>Pembayaran tambahan</option>
          </select>
        </label>

        <label className="field">
          <span>
            Tanggal pembayaran <b>*</b>
          </span>

          <input name="paymentDate" type="date" required />
        </label>

        <label className="field">
          <span>
            Nominal yang dibayarkan (Rp) <b>*</b>
          </span>

          <div className="input-prefix">
            <span>Rp</span>

            <input
              name="amountPaid"
              inputMode="numeric"
              required
              value={amount}
              onChange={(event) => setAmount(formatRupiah(event.target.value))}
              placeholder="0"
            />
          </div>
        </label>

        <label className="field">
          <span>
            Metode pembayaran <b>*</b>
          </span>

          <select name="paymentMethod" required defaultValue="">
            <option value="" disabled>
              Pilih metode pembayaran
            </option>
            <option value="Transfer bank">Transfer bank</option>
            <option value="Virtual account">Virtual account</option>
            <option value="Tunai">Tunai</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </label>
      </div>

      <div className="form-section-title section-spaced">
        <span>03</span>
        <strong>Bukti pembayaran</strong>
      </div>

      <label className={`upload-box${proofFile ? " has-file" : ""}`}>
        <input
          name="proof"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          required
          onChange={handleProofChange}
        />

        <span className="upload-icon">{proofFile ? "✓" : "↑"}</span>

        {proofFile ? (
          <>
            <strong className="upload-file-name">{proofFile.name}</strong>
            <small>{formatFileSize(proofFile.size)} · siap diunggah</small>
            <span className="upload-link">Ganti file</span>
          </>
        ) : (
          <>
            <strong>Pilih bukti transfer untuk diunggah</strong>
            <small>Format JPG, PNG, WEBP, atau PDF · Maksimal 5 MB</small>
            <span className="upload-link">Pilih file dari perangkat</span>
          </>
        )}
      </label>

      <div className="form-section-title section-spaced">
        <span>04</span>
        <strong>Paspor peserta</strong>
      </div>

      <label className={`upload-box${passportFile ? " has-file" : ""}`}>
        <input
          name="passport"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          required
          onChange={handlePassportChange}
        />

        <span className="upload-icon">{passportFile ? "✓" : "↑"}</span>

        {passportFile ? (
          <>
            <strong className="upload-file-name">{passportFile.name}</strong>
            <small>{formatFileSize(passportFile.size)} · siap diunggah</small>
            <span className="upload-link">Ganti file</span>
          </>
        ) : (
          <>
            <strong>Pilih foto atau PDF paspor peserta</strong>
            <small>
              Halaman data diri yang berfoto · JPG, PNG, WEBP, atau PDF ·
              Maksimal 5 MB
            </small>
            <span className="upload-link">Pilih file dari perangkat</span>
          </>
        )}
      </label>

      <label className="field field-full notes-field">
        <span>Catatan tambahan</span>

        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder="Tulis informasi tambahan bila diperlukan (opsional)"
        />
      </label>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <label className="consent">
        <input type="checkbox" name="consent" required />

        <span>
          Saya menyatakan bahwa informasi yang diisi benar dan dapat digunakan
          oleh Farbig International Education untuk keperluan administrasi
          program.
        </span>
      </label>

      <button
        className="button button-primary submit-button"
        type="submit"
        disabled={busy}
      >
        {busy ? "Mengirim data..." : "Kirim konfirmasi pembayaran"}

        <span aria-hidden="true">↗</span>
      </button>

      <p className="form-footnote">
        Dengan menekan tombol kirim, data Anda akan tercatat untuk proses
        verifikasi oleh tim Farbig.
      </p>
    </form>
  );
}
