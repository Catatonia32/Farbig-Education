import "server-only";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";

export async function requireAdmin() {
  const authorized = await isAdminRequest();

  if (!authorized) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: "Sesi admin tidak valid. Silakan login kembali." },
        { status: 401 },
      ),
    };
  }

  return {
    authorized: true as const,
    response: null,
  };
}
