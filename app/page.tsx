import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import PaymentForm from "@/components/PaymentForm";
import "./landing.css";

export const metadata: Metadata = {
  title: "Farbig International Education",
  description:
    "Farbig International Education - Program Study Overseas untuk pelajar yang ingin belajar, terhubung, dan bertumbuh.",
};

const WA_NUMBER = "6285784259890";
const WA_TEXT =
  "Halo tim Farbig, saya ingin bertanya mengenai beberapa informasi seputar program Study Overseas. Bisa dibantu?";
const ADDRESS =
  "Jl. Jemur Sari Timur IV No.08 Blok Ji, Jemur Wonosari, Kec. Wonocolo, Surabaya, Jawa Timur 60237";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;

/* Foto: taruh di /public/images/{code}.jpg (mis. SG.jpg). Jika belum ada, gradien tampil sebagai cadangan. */
const programs = [
  {
    code: "SG",
    flag: "🇸🇬",
    country: "Singapore",
    place: "Universal Studio Singapore",
    days: "6 Hari",
    c1: "#0f766e",
    c2: "#134e4a",
  },
  {
    code: "MY",
    flag: "🇲🇾",
    country: "Malaysia",
    place: "Twin Tower Kuala Lumpur",
    days: "6 Hari",
    c1: "#1d4ed8",
    c2: "#1e3a8a",
  },
  {
    code: "JP",
    flag: "🇯🇵",
    country: "Japan",
    place: "Toyota Automobile Museum",
    days: "8 Hari",
    c1: "#be123c",
    c2: "#7f1d1d",
  },
  {
    code: "CN",
    flag: "🇨🇳",
    country: "China",
    place: "The Great Wall of China",
    days: "7 Hari",
    c1: "#b45309",
    c2: "#78350f",
  },
  {
    code: "KR",
    flag: "🇰🇷",
    country: "Korea Selatan",
    place: "Nami Island",
    days: "14 Hari",
    c1: "#6d28d9",
    c2: "#4c1d95",
  },
  {
    code: "AU",
    flag: "🇦🇺",
    country: "Australia",
    place: "Sydney Opera House",
    days: "7 Hari",
    c1: "#15803d",
    c2: "#14532d",
  },
];

const steps = [
  {
    icon: "📄",
    title: "Siapkan dokumen",
    text: "Bukti transfer dan foto atau PDF paspor peserta yang terbaca jelas.",
  },
  {
    icon: "✍️",
    title: "Isi formulir",
    text: "Lengkapi data peserta dan rincian pembayaran, lalu kirim.",
  },
  {
    icon: "✉️",
    title: "Terima konfirmasi",
    text: "Tim Farbig memeriksa data, lalu bukti verifikasi dikirim ke email Anda.",
  },
];

const stats = [
  { n: "6", l: "Negara tujuan" },
  { n: "6–14", l: "Hari program" },
  { n: "100%", l: "Dipantau tim Farbig" },
];

const tips = [
  "Gunakan nama lengkap peserta sesuai paspor.",
  "Periksa kembali nominal serta tanggal pembayaran.",
  "Unggah bukti transfer dan paspor yang dapat dibaca dengan jelas.",
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`lp-brand${light ? " lp-brand-light" : ""}`}
      aria-label="Farbig Study Overseas"
    >
      <span className="lp-logo">F</span>
      <span>
        <strong>FARBIG</strong>
        <small>INTERNATIONAL EDUCATION</small>
      </span>
    </Link>
  );
}

export default function HomePage() {
  const year = new Date().getFullYear();
  const marquee = [...programs, ...programs];

  return (
    <main className="lp">
      <header className="lp-header">
        <div className="lp-wrap">
          <Brand />
          <nav className="lp-nav" aria-label="Navigasi utama">
            <a href="#destinasi">Destinasi</a>
            <a href="#alur">Alur</a>
            <a href="#petunjuk">Petunjuk</a>
            <a className="lp-btn lp-btn-sm" href="#formulir">
              Isi formulir <span aria-hidden="true">↓</span>
            </a>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <span className="lp-plane" aria-hidden="true">
          ✈
        </span>
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="lp-dot" /> STUDY OVERSEAS PROGRAM
            </span>
            <h1>
              Konfirmasi pelunasan, <em>tanpa ribet.</em>
            </h1>
            <p>
              Lengkapi formulir untuk mengonfirmasi pembayaran program Study
              Overseas putra/putri Anda. Tim Farbig akan memeriksa data dan
              bukti pembayaran yang dikirimkan.
            </p>
            <div className="lp-cta">
              <a className="lp-btn lp-btn-gold" href="#formulir">
                Isi formulir sekarang <span aria-hidden="true">→</span>
              </a>
              <a
                className="lp-btn lp-btn-ghost"
                href={`https://wa.me/${WA_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tanya via WhatsApp
              </a>
            </div>
            <ul className="lp-chips">
              <li>✓ Data hanya untuk administrasi program</li>
              <li>✓ Diperiksa langsung tim Farbig</li>
              <li>✓ Konfirmasi lewat email</li>
            </ul>
          </div>

          <div className="lp-visual" aria-hidden="true">
            <div className="lp-photo lp-photo-main" />
            <div className="lp-photo lp-photo-sm" />
            <div className="lp-pass">
              <span className="lp-stamp">✈</span>
              <div className="lp-pass-top">
                <span>STUDY OVERSEAS</span>
                <span>BOARDING PASS</span>
              </div>
              <ul>
                {programs.map((p) => (
                  <li key={p.code}>
                    <span className="lp-pass-code">{p.code}</span>
                    <span className="lp-pass-place">{p.country}</span>
                    <span className="lp-pass-days">{p.days}</span>
                  </li>
                ))}
              </ul>
              <p className="lp-pass-foot">LEARN · CONNECT · GROW</p>
            </div>
          </div>
        </div>

        <div className="lp-wrap">
          <ul className="lp-stats">
            {stats.map((s) => (
              <li key={s.l}>
                <strong>{s.n}</strong>
                <span>{s.l}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {marquee.map((p, i) => (
            <span key={i}>
              {p.country} <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <section className="lp-section" id="destinasi">
        <div className="lp-wrap">
          <span className="lp-kicker lp-reveal">DESTINASI PROGRAM</span>
          <h2 className="lp-title lp-reveal">
            Belajar langsung dari dunia nyata.
          </h2>
          <ul className="lp-dest-grid">
            {programs.map((p) => (
              <li
                key={p.code}
                className="lp-dest lp-reveal"
                style={
                  {
                    "--img": `url(/images/${p.code}.jpg)`,
                    "--c1": p.c1,
                    "--c2": p.c2,
                  } as CSSProperties
                }
              >
                <span className="lp-dest-flag">{p.code}</span>
                <span className="lp-dest-days">{p.days}</span>
                <div className="lp-dest-info">
                  <small>{p.country}</small>
                  <h3>{p.place}</h3>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-section" id="alur">
        <div className="lp-wrap">
          <span className="lp-kicker lp-reveal">ALUR SINGKAT</span>
          <h2 className="lp-title lp-reveal">
            Tiga langkah, selesai dalam hitungan menit.
          </h2>
          <ol
            className="lp-steps"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {steps.map((s, i) => (
              <li className="lp-step lp-reveal" key={s.title}>
                <span className="lp-step-icon">{s.icon}</span>
                <span className="lp-step-no">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section" id="formulir">
        <div className="lp-wrap lp-form-grid">
          <aside className="lp-aside lp-reveal" id="petunjuk">
            <span className="lp-kicker">01 / PETUNJUK</span>
            <h2>Sebelum mengirimkan.</h2>
            <p>
              Pastikan data peserta sesuai dengan dokumen dan simpan bukti
              pembayaran yang jelas sebelum mulai mengisi.
            </p>
            <ul className="lp-tips">
              {tips.map((tip, i) => (
                <li key={tip}>
                  <span>{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ul>
            <div className="lp-privacy">
              <strong>🔒 Privasi Anda penting</strong>
              Jangan unggah dokumen selain yang diminta dalam formulir.
            </div>
          </aside>
          <div className="form-panel lp-form-card lp-reveal">
            <PaymentForm />
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-grid">
            <div>
              <Brand light />
              <p className="lp-footer-about">
                Learn beyond the classroom. Program Study Overseas untuk pelajar
                yang ingin belajar, terhubung, dan bertumbuh.
              </p>
            </div>

            <nav aria-label="Tautan cepat">
              <h3>Tautan cepat</h3>
              <ul>
                <li>
                  <a href="#destinasi">Destinasi</a>
                </li>
                <li>
                  <a href="#alur">Alur singkat</a>
                </li>
                <li>
                  <a href="#formulir">Formulir pembayaran</a>
                </li>
                <li>
                  <Link href="/admin/login">Portal admin</Link>
                </li>
              </ul>
            </nav>

            <div>
              <h3>Alamat kami</h3>
              <address className="lp-address">
                <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                  {ADDRESS}
                  <span className="lp-address-link">Buka di Google Maps ↗</span>
                </a>
              </address>
            </div>

            <div>
              <h3>Ikuti kami</h3>
              <div className="lp-social">
                <a
                  href="https://www.instagram.com/farbigeducation"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram Farbig International Education"
                >
                  <Icon>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle
                      cx="17.5"
                      cy="6.5"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    />
                  </Icon>
                </a>
                <a
                  href="https://www.linkedin.com/company/farbigeducation/home/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn Farbig International Education"
                >
                  <Icon>
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </Icon>
                </a>
                <a
                  href="https://www.youtube.com/@farbigeducation"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube Farbig International Education"
                >
                  <Icon>
                    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                    <path d="m10 15 5-3-5-3z" />
                  </Icon>
                </a>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {year} Farbig International Education</span>
            <span>LEARN · CONNECT · GROW</span>
          </div>
        </div>
      </footer>

      <a
        className="lp-wa"
        href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_TEXT)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi bantuan Farbig melalui WhatsApp"
      >
        <Icon>
          <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z" />
        </Icon>
        Bantuan
      </a>
    </main>
  );
}
