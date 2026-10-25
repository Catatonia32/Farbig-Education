import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC_ERROR = "Email atau password salah.";

export type AuthResult =
  | {
      ok: true;
      user: {
        id: string;
        fullName: string;
        role: string;
        session_version: number;
      };
    }
  | { ok: false; status: number; error: string };

export async function authenticate(
  rawEmail: string,
  password: string,
): Promise<AuthResult> {
  const email = rawEmail.trim().toLowerCase();

  const { data: user, error } = await supabaseAdmin
    .from("app_users")
    .select(
      "id, full_name, role, is_active, session_version, password_hash, locked_until",
    )
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[login] Gagal membaca app_users:", error.message);
    return { ok: false, status: 500, error: "Terjadi kesalahan pada server." };
  }

  if (!user) {
    await burnPasswordCheck(password);
    return { ok: false, status: 401, error: GENERIC_ERROR };
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return {
      ok: false,
      status: 429,
      error: "Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.",
    };
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const { error: rpcError } = await supabaseAdmin.rpc(
      "record_login_failure",
      {
        p_user_id: user.id,
        p_max_attempts: MAX_ATTEMPTS,
        p_lock_minutes: LOCK_MINUTES,
      },
    );

    if (rpcError) {
      console.error("[login] Gagal mencatat login gagal:", rpcError.message);
    }

    return { ok: false, status: 401, error: GENERIC_ERROR };
  }

  // Akun nonaktif diperlakukan sama seperti salah password.
  if (!user.is_active) {
    return { ok: false, status: 401, error: GENERIC_ERROR };
  }

  const { error: updateError } = await supabaseAdmin
    .from("app_users")
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error(
      "[login] Gagal memperbarui login terakhir:",
      updateError.message,
    );
  }

  return {
    ok: true,
    user: {
      id: user.id,
      fullName: user.full_name,
      role: user.role,
      session_version: user.session_version,
    },
  };
}
