import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, cookieOptions, createSession } from "@/lib/auth";
import { authenticate } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: noStore });
}

export async function POST(request: Request) {
  let email = "";
  let password = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body: unknown = await request.json();
      const data = (body ?? {}) as { email?: unknown; password?: unknown };

      email = typeof data.email === "string" ? data.email : "";
      password = typeof data.password === "string" ? data.password : "";
    } else {
      const form = await request.formData();
      const rawEmail = form.get("email");
      const rawPassword = form.get("password");

      email = typeof rawEmail === "string" ? rawEmail : "";
      password = typeof rawPassword === "string" ? rawPassword : "";
    }
  } catch {
    return fail("Permintaan tidak valid.", 400);
  }

  if (!email.trim() || !password) {
    return fail("Email dan password wajib diisi.", 400);
  }

  if (email.length > 160 || password.length > 200) {
    return fail("Email atau password salah.", 401);
  }

  try {
    const result = await authenticate(email, password);

    if (!result.ok) {
      return fail(result.error, result.status);
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE, createSession(result.user), cookieOptions);

    return NextResponse.json(
      { ok: true, name: result.user.fullName, role: result.user.role },
      { headers: noStore },
    );
  } catch (error) {
    console.error("[login] Server error:", error);
    return fail("Terjadi kesalahan pada server.", 500);
  }
}
