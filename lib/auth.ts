import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const ADMIN_COOKIE = "farbig_admin_session";

export const ROLES = ["viewer", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  admin: 2,
  super_admin: 3,
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

export function hasRole(role: Role, minimum: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

const EIGHT_HOURS = 8 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionPayload = {
  uid: string;
  sv: number;
  exp: number;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

function getSecret(): string | null {
  const value = process.env.AUTH_SECRET;
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

function sign(payload: string): string {
  const key = getSecret();

  if (!key) {
    throw new Error("AUTH_SECRET wajib diatur dan minimal 32 karakter.");
  }

  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

export function createSession(user: {
  id: string;
  session_version: number;
}): string {
  const payload: SessionPayload = {
    uid: user.id,
    sv: user.session_version,
    exp: Math.floor(Date.now() / 1000) + EIGHT_HOURS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

// Memeriksa tanda tangan dan masa berlaku saja (tanpa database).
export function readSession(token?: string | null): SessionPayload | null {
  if (!token || token.length > 4096 || !getSecret()) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  if (
    !payload ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) {
    return null;
  }

  try {
    if (!safeEqual(sign(payload), signature)) {
      return null;
    }

    const data: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (typeof data !== "object" || data === null) return null;

    const session = data as { uid?: unknown; sv?: unknown; exp?: unknown };

    if (
      typeof session.uid !== "string" ||
      !UUID_PATTERN.test(session.uid) ||
      typeof session.sv !== "number" ||
      !Number.isSafeInteger(session.sv) ||
      typeof session.exp !== "number" ||
      !Number.isSafeInteger(session.exp) ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { uid: session.uid, sv: session.sv, exp: session.exp };
  } catch {
    return null;
  }
}

// Kompatibilitas: hanya memeriksa tanda tangan, tidak memeriksa database.
export function isValidSession(token?: string | null): boolean {
  return readSession(token) !== null;
}

// Sumber kebenaran: setiap request memeriksa database, jadi user yang
// dinonaktifkan atau diganti passwordnya langsung kehilangan akses.
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!session) return null;

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, full_name, role, is_active, session_version")
    .eq("id", session.uid)
    .maybeSingle();

  if (error) {
    console.error("[auth] Gagal memeriksa sesi:", error.message);
    return null;
  }

  if (
    !data ||
    !data.is_active ||
    data.session_version !== session.sv ||
    !isRole(data.role)
  ) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
  };
}

// Kompatibilitas: true bila user aktif dan levelnya admin ke atas.
export async function isAdminRequest(): Promise<boolean> {
  const user = await getSessionUser();
  return user !== null && hasRole(user.role, "admin");
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: EIGHT_HOURS,
};
