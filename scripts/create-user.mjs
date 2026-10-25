import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scrypt } from "node:crypto";
import readline from "node:readline";

// .env.local diprioritaskan, lalu .env (nilai yang sudah terisi tidak ditimpa).
config({ path: [".env.local", ".env"], quiet: true });

const ROLES = ["viewer", "admin", "super_admin"];
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

// Menjelaskan penyebab error Supabase yang paling sering.
function explain(error) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`;

  if (/PGRST205|42P01|schema cache|does not exist/i.test(text)) {
    return "Tabel app_users belum ada. Jalankan SQL tabel user di Supabase SQL Editor dulu.";
  }
  if (/Invalid API key|JWT|apikey/i.test(text)) {
    return "SUPABASE_SECRET_KEY salah. Pakai secret key dari Supabase → Project Settings → API Keys.";
  }
  if (/42501|permission denied/i.test(text)) {
    return "Hak akses ditolak. Pastikan memakai secret key (bukan publishable) dan baris GRANT ... TO service_role pada SQL sudah dijalankan.";
  }
  if (/fetch failed|ENOTFOUND|ECONN/i.test(text)) {
    return "Tidak bisa terhubung ke Supabase. Periksa SUPABASE_URL dan koneksi internet.";
  }
  if (/23505|duplicate key/i.test(text)) {
    return "Email sudah terdaftar.";
  }
  if (/23514|check constraint/i.test(text)) {
    return "Data ditolak aturan tabel. Periksa format email, role, dan panjang nama.";
  }

  return "";
}

function dbFail(prefix, error) {
  const hint = explain(error);
  const code = error.code ? ` (kode ${error.code})` : "";

  fail(`${prefix}: ${error.message}${code}${hint ? `\n  → ${hint}` : ""}`);
}

// Input biasa (terlihat saat diketik).
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Input password (tidak ditampilkan), memakai raw mode agar andal di Windows.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      reject(
        new Error(
          "Terminal tidak interaktif. Jalankan langsung di terminal PowerShell/CMD (atau terminal VS Code).",
        ),
      );
      return;
    }

    process.stdout.write(question);

    let value = "";

    const finish = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          // Ctrl+C
          finish();
          process.exit(130);
        }

        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        // Abaikan urutan tombol khusus (panah, dll).
        if (char === "\u001b") break;

        if (char >= " ") value += char;
      }
    };

    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, PARAMS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

// Format harus sama persis dengan lib/password.ts
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!key) missing.push("SUPABASE_SECRET_KEY");

  if (missing.length > 0) {
    fail(
      `${missing.join(" dan ")} tidak ditemukan.\n  → Pastikan ada di file .env.local atau .env pada folder proyek, dan jalankan perintah dari folder proyek.`,
    );
  }

  if (key.startsWith("sb_publishable_")) {
    fail(
      "SUPABASE_SECRET_KEY berisi publishable key. Gunakan secret key (sb_secret_...) dari Supabase.",
    );
  }

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    fail(
      "SUPABASE_URL bukan alamat yang valid. Contoh: https://xxxx.supabase.co",
    );
  }

  console.log(`Terhubung ke: ${host}`);

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = (arg("email") ?? (await ask("Email: "))).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    fail("Format email tidak valid.");
  }

  const { data: existing, error: lookupError } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) dbFail("Gagal memeriksa user", lookupError);

  if (existing && !hasFlag("reset")) {
    fail(
      "Email sudah terdaftar. Tambahkan --reset untuk mengganti passwordnya.",
    );
  }

  let fullName = "";
  let role = "admin";

  if (!existing) {
    fullName = (arg("name") ?? (await ask("Nama lengkap: "))).trim();
    role = (arg("role") ?? "admin").trim();

    if (!fullName || fullName.length > 120) {
      fail("Nama lengkap wajib diisi (maks. 120 karakter).");
    }

    if (!ROLES.includes(role)) {
      fail(`Role harus salah satu dari: ${ROLES.join(", ")}`);
    }
  }

  const password = await askHidden("Password (min. 5 karakter): ");
  const confirm = await askHidden("Ulangi password: ");

  if (password.length < 5) fail("Password minimal 5 karakter.");
  if (password.length > 200) fail("Password maksimal 200 karakter.");
  if (password !== confirm) fail("Password tidak sama.");

  const passwordHash = await hashPassword(password);

  if (existing) {
    const { error } = await supabase
      .from("app_users")
      .update({ password_hash: passwordHash })
      .eq("id", existing.id);

    if (error) dbFail("Gagal mengganti password", error);

    console.log(
      `\n✓ Password ${email} diganti. Semua sesi lamanya otomatis keluar.`,
    );
    return;
  }

  const { error } = await supabase.from("app_users").insert({
    email,
    full_name: fullName,
    password_hash: passwordHash,
    role,
  });

  if (error) dbFail("Gagal membuat user", error);

  console.log(`\n✓ User ${email} (${role}) berhasil dibuat.`);
  console.log("  Sekarang bisa login di /admin/login");
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
