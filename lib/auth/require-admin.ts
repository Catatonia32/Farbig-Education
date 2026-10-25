import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, hasRole, type Role } from "@/lib/auth";

// Default "admin": viewer ditolak. Untuk route yang hanya membaca data,
// bisa dipanggil requireAdmin("viewer"). Untuk kelola user: requireAdmin("super_admin").
export async function requireAdmin(minimumRole: Role = "admin") {
  const user = await getSessionUser();

  if (!user) {
    return {
      authorized: false as const,
      user: null,
      response: NextResponse.json(
        { error: "Sesi admin tidak valid. Silakan login kembali." },
        { status: 401 },
      ),
    };
  }

  if (!hasRole(user.role, minimumRole)) {
    return {
      authorized: false as const,
      user: null,
      response: NextResponse.json(
        { error: "Anda tidak memiliki izin untuk aksi ini." },
        { status: 403 },
      ),
    };
  }

  return {
    authorized: true as const,
    user,
    response: null,
  };
}
