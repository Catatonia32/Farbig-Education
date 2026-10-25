import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "payment-proofs";

// Nama folder harus sama persis dengan di Supabase (huruf besar/kecil dibedakan).
export const PROOF_FOLDER = "Payments";
export const PASSPORT_FOLDER = "Passports";

// Hanya nama file aman (UUID + ekstensi), mencegah path traversal.
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

/**
 * Mengunduh file dari bucket dengan mencoba beberapa folder secara berurutan.
 * Folder "" berarti root bucket (untuk data lama sebelum folder dibuat).
 */
export async function downloadStoredFile(
  client: SupabaseClient,
  filename: string,
  folders: string[],
) {
  if (!SAFE_FILENAME.test(filename)) return null;

  for (const folder of folders) {
    const path = folder ? `${folder}/${filename}` : filename;
    const { data, error } = await client.storage.from(BUCKET).download(path);

    if (!error && data) {
      return { blob: data, path };
    }
  }

  return null;
}
