import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "farbig_admin_session";

const EIGHT_HOURS = 8 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

type SessionPayload = {
  role: "admin";
  exp: number;
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

export function createSession(): string {
  const payload: SessionPayload = {
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + EIGHT_HOURS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function isValidSession(token?: string | null): boolean {
  if (!token || token.length > 4096 || !getSecret()) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;

  if (
    !payload ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) {
    return false;
  }

  try {
    if (!safeEqual(sign(payload), signature)) {
      return false;
    }

    const decoded = Buffer.from(payload, "base64url").toString("utf8");

    const data: unknown = JSON.parse(decoded);

    if (
      typeof data !== "object" ||
      data === null ||
      !("role" in data) ||
      !("exp" in data)
    ) {
      return false;
    }

    const session = data as {
      role?: unknown;
      exp?: unknown;
    };

    return (
      session.role === "admin" &&
      typeof session.exp === "number" &&
      Number.isSafeInteger(session.exp) &&
      session.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function isAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  return isValidSession(token);
}

export function credentialsMatch(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim();
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword || !email || !password) {
    return false;
  }

  return (
    safeEqual(email.trim().toLowerCase(), expectedEmail.toLowerCase()) &&
    safeEqual(password, expectedPassword)
  );
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: EIGHT_HOURS,
};
