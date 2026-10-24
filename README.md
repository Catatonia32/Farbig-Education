# Farbig Study Overseas Form — Next.js App Router

Aplikasi konfirmasi pembayaran untuk Farbig International Education, dibuat dengan Next.js App Router, TypeScript, dan SQLite.

## Teknologi

- Next.js **16.4.2** dengan App Router
- React 19.3.x, TypeScript
- SQLite melalui `better-sqlite3`
- Dashboard admin dengan autentikasi cookie HTTP-only bertanda tangan HMAC
- Unggah bukti pembayaran disimpan di folder privat, tidak dipublikasi sebagai static file
- Ekspor CSV yang dapat dibuka di Excel

Persyaratan: Node.js **20.9 atau lebih baru** dan npm.

## Menjalankan aplikasi secara lokal

1. Ekstrak ZIP ini, lalu buka Terminal di folder `farbig-study-overseas-nextjs`.
2. Pasang dependensi:

   ```bash
   npm install
   ```

3. Salin `.env.example` menjadi `.env` (Windows bisa menyalin file melalui File Explorer), lalu edit kredensial admin dan secret:

   ```env
   ADMIN_EMAIL=admin@farbig.id
   ADMIN_PASSWORD=GantiDenganPasswordUnikYangPanjang
   AUTH_SECRET=masukkan-random-secret-panjang-minimal-32-karakter
   DATABASE_PATH=./data/farbig.sqlite
   UPLOAD_DIR=./storage/uploads
   ```

   Gunakan kata sandi yang kuat dan random secret yang panjang. Jangan commit file `.env` ke Git.

4. Jalankan server development:

   ```bash
   npm run dev
   ```

5. Buka halaman di browser:
   - Formulir: http://localhost:3000
   - Admin: http://localhost:3000/admin/login

## Fitur

- Form publik konfirmasi pembayaran/ pelunasan peserta
- Validasi data dan tipe/ukuran dokumen (maks. 5 MB; JPG, PNG, WEBP, PDF)
- Bukti pembayaran disimpan privat dan hanya dapat diakses melalui endpoint admin yang terautentikasi
- Dashboard metrik ringkas, pencarian, dan filter status
- Detail respons, pratinjau bukti, ubah status menjadi Menunggu, Terverifikasi, atau Ditolak
- Ekspor CSV UTF-8 yang kompatibel dengan Excel
- Database dibuat otomatis pada start pertama

## Menyesuaikan formulir

Pilihan program dapat diubah di `components/PaymentForm.tsx` dan set validasinya di `app/api/submissions/route.ts`. Database schema dibuat pada `lib/db.ts`. Bila menambah field yang ingin disimpan, tambahkan kolom di schema SQLite, validasi API dan perintah INSERT, tipe data dashboard, lalu tampilan form/admin.

## Catatan deployment

Aplikasi ini memakai SQLite dan penyimpanan file lokal. Jalankan pada server Node.js yang memiliki disk persisten dan akses tulis ke folder database serta unggahan. Untuk serverless seperti deployment standar Vercel, gunakan database terkelola (misalnya PostgreSQL) dan object storage, karena filesystem lokal biasanya tidak persisten antar deployment/instance.

Sebelum production:

- Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` yang unik, `DATABASE_PATH`, `UPLOAD_DIR`, serta HTTPS.
- Pastikan volume penyimpanan memiliki backup rutin dan permission privat.
- Jangan gunakan akun admin contoh.
- Uji alur pengiriman, login, unduh CSV, akses bukti, dan pemulihan data di lingkungan hosting.

## Struktur folder penting

```text
app/
  api/                 # API route handlers
  admin/               # Portal admin
  page.tsx             # Form publik
  globals.css          # UI responsive
components/             # Form input & dashboard admin
lib/                    # Database dan otentikasi
storage/uploads/        # Bukti pembayaran privat
data/                   # File database SQLite lokal
```

## Catatan referensi Google Form

Tautan Google Form contoh meminta akses/login sehingga detail pertanyaan sumber belum dapat diverifikasi. Field dan pilihan di dalam proyek ini merupakan baseline formulir konfirmasi pembayaran Farbig, dan dapat disesuaikan dengan formulir asli.
