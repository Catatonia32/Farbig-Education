"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { getRealtimeClient } from "@/lib/supabase/browser";

type Status = "pending" | "verified" | "rejected";

type LiveStatus = "off" | "connecting" | "live" | "offline";

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
  notes: string | null;
  proof_file: string;
  passport_file: string | null;
  status: Status;
};

type PatchResult = {
  emailSent?: boolean;
  emailError?: string | null;
};

type FetchResult =
  | { ok: true; items: Submission[] }
  | { ok: false; unauthorized: boolean; error: string };

// Nilai NEXT_PUBLIC_* ditanam saat build, jadi sama di server dan browser.
const realtimeConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const swal = Swal.mixin({
  heightAuto: false,
  // Pastikan SweetAlert selalu tampil di atas modal detail.
  didOpen: (popup) => {
    const container = popup.parentElement;
    if (container) container.style.zIndex = "9999";
  },
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

async function fetchSubmissions(): Promise<FetchResult> {
  try {
    const res = await fetch("/api/admin/submissions", { cache: "no-store" });

    if (res.status === 401) {
      return { ok: false, unauthorized: true, error: "" };
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        unauthorized: false,
        error: json.error || "Data tidak dapat dimuat.",
      };
    }

    return { ok: true, items: json.items as Submission[] };
  } catch (err) {
    return {
      ok: false,
      unauthorized: false,
      error: err instanceof Error ? err.message : "Gagal mengambil data.",
    };
  }
}

async function patchStatus(
  item: Submission,
  status: Status,
): Promise<PatchResult> {
  const res = await fetch(`/api/admin/submissions/${item.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || "Status gagal diperbarui.");
  }

  return json as PatchResult;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(
    realtimeConfigured ? "connecting" : "off",
  );

  // Terapkan data terbaru, dan sinkronkan modal detail yang sedang terbuka.
  const applyItems = useCallback((next: Submission[]) => {
    setItems(next);
    setError("");
    setSelected((old) =>
      old ? (next.find((item) => item.id === old.id) ?? null) : old,
    );
  }, []);

  // Pemuatan awal dan tombol "Muat ulang".
  useEffect(() => {
    let cancelled = false;

    fetchSubmissions().then((result) => {
      if (cancelled) return;

      if (result.ok) {
        applyItems(result.items);
      } else if (result.unauthorized) {
        router.push("/admin/login");
      } else {
        setError(result.error);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router, reloadKey, applyItems]);

  // Realtime: dengarkan siaran perubahan dari database, lalu muat ulang diam-diam.
  useEffect(() => {
    const supabase = getRealtimeClient();

    if (!supabase) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      fetchSubmissions().then((result) => {
        if (cancelled) return;

        if (result.ok) {
          applyItems(result.items);
        } else if (result.unauthorized) {
          router.push("/admin/login");
        }
      });
    };

    // Gabungkan beberapa siaran beruntun menjadi satu pemuatan.
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };

    const channel = supabase
      .channel("admin-submissions")
      .on("broadcast", { event: "submission_changed" }, scheduleRefresh)
      .subscribe((status) => {
        if (cancelled) return;

        if (status === "SUBSCRIBED") {
          setLiveStatus("live");
          // Sinkronkan data yang mungkin terlewat saat terputus.
          scheduleRefresh();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setLiveStatus("offline");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", scheduleRefresh);

    // Jaring pengaman: siaran tidak dijamin terkirim, jadi sinkronkan tiap 60 detik.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", scheduleRefresh);
      supabase.removeChannel(channel);
    };
  }, [router, applyItems]);

  // Tombol Esc menutup modal detail (dilewati saat SweetAlert terbuka).
  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (Swal.isVisible()) return;
      setSelected(null);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

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

  async function confirmStatusChange(
    item: Submission,
    status: "verified" | "rejected",
  ) {
    const isVerify = status === "verified";

    const emailInfo = isVerify
      ? item.email
        ? `Email berisi bukti pembayaran akan langsung dikirim ke <b>${escapeHtml(item.email)}</b>.`
        : "Peserta ini tidak memiliki alamat email, sehingga email tidak akan dikirim."
      : "Pembayaran akan ditandai sebagai ditolak. Pastikan bukti pembayaran sudah diperiksa.";

    const result = await swal.fire({
      icon: isVerify ? "question" : "warning",
      title: isVerify ? "Verifikasi pembayaran ini?" : "Tolak pembayaran ini?",
      html: `
        <div style="text-align:left;line-height:1.6">
          <div><b>${escapeHtml(item.student_name)}</b> · ${escapeHtml(item.destination)}</div>
          <div>${escapeHtml(money(item.amount_paid))} · ${escapeHtml(item.payment_method)}</div>
          <div style="margin-top:10px">${emailInfo}</div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: isVerify ? "Ya, verifikasi" : "Ya, tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: isVerify ? "#1a4d3e" : "#9b2c2c",
      reverseButtons: true,
      focusCancel: !isVerify,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      allowEscapeKey: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          return await patchStatus(item, status);
        } catch (err) {
          Swal.showValidationMessage(
            err instanceof Error ? err.message : "Gagal memperbarui status.",
          );
          return false;
        }
      },
    });

    if (!result.isConfirmed || !result.value) return;

    const json = result.value as PatchResult;

    setItems((old) =>
      old.map((x) => (x.id === item.id ? { ...x, status } : x)),
    );
    setSelected(null);

    if (json.emailError) {
      await swal.fire({
        icon: "warning",
        title: "Status tersimpan",
        text: json.emailError,
        confirmButtonText: "Mengerti",
        confirmButtonColor: "#1a4d3e",
      });
      return;
    }

    await swal.fire({
      icon: "success",
      title: isVerify ? "Pembayaran terverifikasi" : "Pembayaran ditolak",
      text:
        isVerify && json.emailSent
          ? "Email bukti pembayaran telah dikirim ke peserta."
          : undefined,
      timer: 2200,
      timerProgressBar: true,
      showConfirmButton: false,
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const liveLabel =
    liveStatus === "live"
      ? "LIVE"
      : liveStatus === "connecting"
        ? "MENYAMBUNG"
        : "OFFLINE";

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
          <span
            className="admin-label"
            title={
              liveStatus === "live"
                ? "Data diperbarui otomatis"
                : liveStatus === "off"
                  ? "Realtime belum dikonfigurasi"
                  : "Pembaruan otomatis sedang tidak tersambung"
            }
          >
            <span
              className="live-dot"
              style={liveStatus === "live" ? undefined : { opacity: 0.35 }}
            />{" "}
            ADMIN PORTAL
            {liveStatus !== "off" && <> · {liveLabel}</>}
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
              <div className="detail-full">
                <small>Paspor peserta</small>
                {selected.passport_file ? (
                  <a
                    className="proof-link"
                    href={`/api/admin/uploads/${encodeURIComponent(selected.passport_file)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka paspor peserta ↗
                  </a>
                ) : (
                  <p>Belum diunggah.</p>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="button button-outline"
                disabled={selected.status === "rejected"}
                onClick={() => void confirmStatusChange(selected, "rejected")}
              >
                {selected.status === "rejected" ? "Sudah ditolak" : "Tolak"}
              </button>
              <button
                className="button button-primary"
                disabled={selected.status === "verified"}
                onClick={() => void confirmStatusChange(selected, "verified")}
              >
                {selected.status === "verified"
                  ? "✓ Sudah terverifikasi"
                  : "✓ Verifikasi pembayaran"}
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
