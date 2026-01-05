// netlify/functions/_lib/loadP12FromStorage.ts
import { adminBucket } from "./firebaseAdmin";

export async function loadP12FromStorage(storagePath: string): Promise<Buffer> {
  if (!storagePath) throw new Error("storagePath requerido");
  const file = adminBucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`No existe P12 en: ${storagePath}`);

  const [buf] = await file.download();
  return buf;
}