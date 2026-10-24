import Link from "next/link";
import AdminLoginForm from "@/components/AdminLoginForm";

export const metadata = { title: "Login Admin | Farbig" };

export default function AdminLoginPage() {
  return (
    <main className="admin-auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-symbol">F</span>
        <span className="brand-copy">
          <strong>FARBIG</strong>
          <small>INTERNATIONAL EDUCATION</small>
        </span>
      </Link>
      <div className="auth-card">
        <span className="eyebrow">PORTAL INTERNAL</span>
        <h1>Selamat datang.</h1>
        <p>
          Masuk untuk mengelola konfirmasi pembayaran peserta Study Overseas.
        </p>
        <AdminLoginForm />
      </div>
      <Link href="/" className="auth-back">
        ← Kembali ke formulir peserta
      </Link>
    </main>
  );
}
