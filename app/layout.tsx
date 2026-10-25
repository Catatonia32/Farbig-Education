import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farbig Study Overseas | Konfirmasi Pembayaran",
  description:
    "Formulir resmi konfirmasi pelunasan program Study Overseas Farbig International Education.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
