"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Status = "pending" | "verified" | "rejected";

type Submission = {
  id: number;
  created_at: string;
  parent_name: string;
  phone: string;
  email: string | null;
  student_name: string;
  school: string;
  destination: string;
  payment_type: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  transfer_note: string | null;
  notes: string | null;
  proof_file: string;
  status: Status;
};

type Confirming = {
  item: Submission;
  status: "verified" | "rejected";
};

const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const date = (s: string) => {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  const d = new Date(s.replace(" ", "T") + (hasZone ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function AdminDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/submissions", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Data tidak dapat dimuat.");
        if (!cancelled) setItems(json.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Gagal mengambil data.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  // Tombol Esc menutup dialog teratas.
  useEffect(() => {
    if (!selected && !confirming) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (changingId !== null) return;

      if (confirming) {
        setConfirming(null);
        return;
      }

      setSelected(null);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected, confirming, changingId]);

  function refresh() {
    setLoading(true);
    setError("");
    setReloadKey((k) => k + 1);
  }

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const haystack =
          `${item.parent_name} ${item.student_name} ${item.school} ${item.phone} ${item.email ?? ""} ${item.destination}`.toLowerCase();
        return (
          (filter === "all" || item.status === filter) &&
          haystack.includes(query.toLowerCase())
        );
      }),
    [items, filter, query],
  );

  const total = items.reduce((sum, item) => sum + item.amount_paid, 0);
  const pending = items.filter((item) => item.status === "pending").length;
  const verified = items.filter((item) => item.status === "verified").length;

  async function updateStatus(item: Submission, status: Status) {
    setChangingId(item.id);
    try {
      const res = await fetch(`/api/admin/submissions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Status gagal diperbarui.");
      setItems((old) =>
        old.map((x) => (x.id === item.id ? { ...x, status } : x)),
      );
      setConfirming(null);
      setSelected(null);
      if (json.emailError) alert(json.emailError);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui status.");
    } finally {
      setChangingId(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const confirmBusy = confirming !== null && changingId === confirming.item.id;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="brand" href="/">
          <span className="brand-symbol">F</span>
          <span className="brand-copy">
            <strong>FARBIG</strong>
            <small>INTERNATIONAL EDUCATION</small>
          </span>
        </Link>
        <div className="admin-actions">
          <span className="admin-label">
            <span className="live-dot" /> ADMIN PORTAL
          </span>
          <button
            className="button button-outline button-small"
            onClick={logout}
          >
            Keluar ↗
          </button>
        </div>
      </header>

      <section className="admin-page-head">
        <div>
          <span className="eyebrow">DASHBOARD ADMINISTRASI</span>
          <h1>
            Respons pembayaran<span>.</span>
          </h1>
          <p>Pantau, periksa, dan verifikasi konfirmasi pembayaran peserta.</p>
        </div>
        <div className="head-actions">
          <a className="button button-primary" href="/api/admin/export">
            Unduh Excel <span>↓</span>
          </a>
          <button className="button button-outline" onClick={refresh}>
            ↻ Muat ulang
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>Total konfirmasi</span>
          <strong>{items.length}</strong>
          <small>Seluruh respons tersimpan</small>
          <span className="stat-mark">↗</span>
        </div>
        <div className="stat-card">
          <span>Perlu diverifikasi</span>
          <strong>{pending}</strong>
          <small>Menunggu pemeriksaan tim</small>
          <span className="stat-mark stat-warn">◷</span>
        </div>
        <div className="stat-card">
          <span>Terverifikasi</span>
          <strong>{verified}</strong>
          <small>Konfirmasi telah disetujui</small>
          <span className="stat-mark stat-good">✓</span>
        </div>
        <div className="stat-card">
          <span>Total nominal dilaporkan</span>
          <strong className="stat-money">{money(total)}</strong>
          <small>Akumulasi semua respons</small>
          <span className="stat-mark">Rp</span>
        </div>
      </section>

      <section className="table-panel">
        <div className="table-toolbar">
          <div>
            <h2>Daftar respons</h2>
            <p>{filtered.length} data ditampilkan</p>
          </div>
          <div className="table-filters">
            <label className="search-box">
              <span>⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari peserta, sekolah..."
              />
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter status"
            >
              <option value="all">Semua status</option>
              <option value="pending">Menunggu</option>
              <option value="verified">Terverifikasi</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>

        {error && <div className="form-error admin-error">{error}</div>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Peserta</th>
                <th>Program</th>
                <th>Pembayaran</th>
                <th>Tanggal masuk</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-table">
                    Memuat data respons...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-table">
                    Belum ada respons yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <strong>{item.student_name}</strong>
                        <small>{item.school}</small>
                        <small>
                          {item.parent_name} · {item.phone}
                        </small>
                        <span className="reference-mini">
                          FARBIG-{String(item.id).padStart(6, "0")}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="program-name">{item.destination}</span>
                      <small className="sub-cell">{item.payment_type}</small>
                    </td>
                    <td>
                      <strong>{money(item.amount_paid)}</strong>
                      <small className="sub-cell">{item.payment_method}</small>
                    </td>
                    <td>{date(item.created_at)}</td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>
                        {item.status === "pending"
                          ? "Menunggu"
                          : item.status === "verified"
                            ? "Terverifikasi"
                            : "Ditolak"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="view-button"
                        onClick={() => setSelected(item)}
                      >
                        Lihat ↗
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>Data tersimpan di database aplikasi.</span>
          <span>Farbig International Education</span>
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">
                  REFERENSI FARBIG-{String(selected.id).padStart(6, "0")}
                </span>
                <h2 id="detail-title">Detail konfirmasi</h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setSelected(null)}
                aria-label="Tutup detail"
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <small>Nama peserta</small>
                <strong>{selected.student_name}</strong>
              </div>
              <div>
                <small>Orang tua / wali</small>
                <strong>{selected.parent_name}</strong>
              </div>
              <div>
                <small>Nomor WhatsApp</small>
                <strong>{selected.phone}</strong>
              </div>
              <div>
                <small>Email</small>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {selected.email || "—"}
                </strong>
              </div>
              <div>
                <small>Asal sekolah</small>
                <strong>{selected.school}</strong>
              </div>
              <div>
                <small>Program</small>
                <strong>{selected.destination}</strong>
              </div>
              <div>
                <small>Jenis pembayaran</small>
                <strong>{selected.payment_type}</strong>
              </div>
              <div>
                <small>Nominal dilaporkan</small>
                <strong>{money(selected.amount_paid)}</strong>
              </div>
              <div>
                <small>Tanggal pembayaran</small>
                <strong>{date(selected.payment_date)}</strong>
              </div>
              <div>
                <small>Metode pembayaran</small>
                <strong>{selected.payment_method}</strong>
              </div>
              <div>
                <small>Nama pengirim / berita</small>
                <strong>{selected.transfer_note || "—"}</strong>
              </div>
              <div className="detail-full">
                <small>Catatan tambahan</small>
                <p>{selected.notes || "Tidak ada catatan tambahan."}</p>
              </div>
              <div className="detail-full">
                <small>Bukti pembayaran</small>
                <a
                  className="proof-link"
                  href={`/api/admin/uploads/${encodeURIComponent(selected.proof_file)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka bukti pembayaran ↗
                </a>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="button button-outline"
                disabled={selected.status === "rejected"}
                onClick={() =>
                  setConfirming({ item: selected, status: "rejected" })
                }
              >
                {selected.status === "rejected" ? "Sudah ditolak" : "Tolak"}
              </button>
              <button
                className="button button-primary"
                disabled={selected.status === "verified"}
                onClick={() =>
                  setConfirming({ item: selected, status: "verified" })
                }
              >
                {selected.status === "verified"
                  ? "✓ Sudah terverifikasi"
                  : "✓ Verifikasi pembayaran"}
              </button>
            </div>
          </section>
        </div>
      )}

      {confirming && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1000 }}
          onClick={() => {
            if (!confirmBusy) setConfirming(null);
          }}
        >
          <section
            className="detail-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            style={{ width: "min(440px, 92vw)", maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">
                  KONFIRMASI · FARBIG-
                  {String(confirming.item.id).padStart(6, "0")}
                </span>
                <h2 id="confirm-title">
                  {confirming.status === "verified"
                    ? "Verifikasi pembayaran ini?"
                    : "Tolak pembayaran ini?"}
                </h2>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, margin: "8px 0 20px" }}>
              <p style={{ margin: 0 }}>
                <strong>{confirming.item.student_name}</strong> ·{" "}
                {confirming.item.destination}
                <br />
                {money(confirming.item.amount_paid)} ·{" "}
                {confirming.item.payment_method}
              </p>

              {confirming.status === "verified" ? (
                <p style={{ margin: 0 }}>
                  {confirming.item.email
                    ? `Email berisi bukti pembayaran akan langsung dikirim ke ${confirming.item.email}.`
                    : "Peserta ini tidak memiliki alamat email, sehingga email tidak akan dikirim."}
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  Pembayaran akan ditandai sebagai ditolak. Pastikan bukti
                  pembayaran sudah diperiksa.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="button button-outline"
                disabled={confirmBusy}
                onClick={() => setConfirming(null)}
              >
                Batal
              </button>
              <button
                className="button button-primary"
                disabled={confirmBusy}
                style={
                  confirming.status === "rejected"
                    ? { background: "#9b2c2c", borderColor: "#9b2c2c" }
                    : undefined
                }
                onClick={() =>
                  void updateStatus(confirming.item, confirming.status)
                }
              >
                {confirmBusy
                  ? "Menyimpan..."
                  : confirming.status === "verified"
                    ? "Ya, verifikasi"
                    : "Ya, tolak"}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="footer admin-footer">
        <span>© {new Date().getFullYear()} Farbig International Education</span>
        <span>INTERNAL ADMINISTRATION</span>
      </footer>
    </main>
  );
}
