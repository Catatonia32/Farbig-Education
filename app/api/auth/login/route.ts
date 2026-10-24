import { NextResponse } from "next/server";
import { createSession, credentialsMatch, ADMIN_COOKIE, cookieOptions } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 254 || body.password.length > 512) return NextResponse.json({ error: "Email atau kata sandi tidak valid." }, { status: 400 });
    if (!credentialsMatch(body.email, body.password)) return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, createSession(), cookieOptions);
    return response;
  } catch { return NextResponse.json({ error: "Permintaan login tidak valid." }, { status: 400 }); }
}
