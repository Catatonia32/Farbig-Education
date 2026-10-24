import Link from "next/link";
import PaymentForm from "@/components/PaymentForm";

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Farbig Study Overseas">
          <span className="brand-symbol">F</span>
          <span className="brand-copy">
            <strong>FARBIG</strong>
            <small>INTERNATIONAL EDUCATION</small>
          </span>
        </Link>
        <Link className="topbar-link" href="/admin/login">
          Portal Admin <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-dot" /> STUDY OVERSEAS PROGRAM
          </span>
          <h1>
            Konfirmasi
            <br />
            <em>pelunasan.</em>
          </h1>
          <p>
            Mohon lengkapi formulir ini untuk mengonfirmasi pembayaran program
            Study Overseas putra/putri Anda. Tim Farbig akan memeriksa data dan
            bukti pembayaran yang dikirimkan.
          </p>
          <div className="hero-meta">
            <span className="meta-icon">✓</span>
            <span>
              <strong>Proses yang aman</strong>
              <small>Data digunakan untuk administrasi program</small>
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-card">
            <span className="art-card-label">YOUR NEXT CHAPTER</span>
            <div className="globe">◎</div>
            <div className="art-route">
              <span>✦</span>
              <span className="route-line" />
              <span>✦</span>
            </div>
            <strong>
              Learn beyond
              <br />
              the classroom.
            </strong>
            <small>FARBIG · STUDY OVERSEAS</small>
          </div>
          <div className="art-stamp">
            LEARN
            <br />
            CONNECT
            <br />
            GROW
          </div>
        </div>
      </section>

      <section className="content-grid">
        <aside className="side-note">
          <span className="section-index">01 / PETUNJUK</span>
          <h2>
            Sebelum
            <br />
            mengirimkan.
          </h2>
          <p>
            Pastikan data peserta sesuai dengan dokumen dan simpan bukti
            pembayaran yang jelas sebelum mulai mengisi.
          </p>
          <div className="tip-list">
            <div className="tip">
              <span>01</span>
              <p>Gunakan nama lengkap peserta sesuai paspor.</p>
            </div>
            <div className="tip">
              <span>02</span>
              <p>Periksa kembali nominal serta tanggal pembayaran.</p>
            </div>
            <div className="tip">
              <span>03</span>
              <p>Unggah bukti transfer yang dapat dibaca dengan jelas.</p>
            </div>
          </div>
          <div className="privacy-note">
            <span className="privacy-icon">⌑</span>
            <span>
              <strong>Privasi Anda penting</strong>
              <small>
                Jangan unggah dokumen selain yang diminta dalam formulir.
              </small>
            </span>
          </div>
        </aside>
        <div className="form-panel">
          <PaymentForm />
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Farbig International Education</span>
        <span>LEARN · CONNECT · GROW</span>
      </footer>
    </main>
  );
}
