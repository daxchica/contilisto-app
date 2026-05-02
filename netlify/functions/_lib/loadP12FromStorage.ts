// netlify/functions/_lib/loadP12FromStorage.ts
import { adminBucket } from "../_server/firebaseAdmin";

export async function loadP12FromStorage(storagePath: string) {
  const file = adminBucket.file(storagePath);
  
  const [buffer] = await file.download();
  
  return buffer.toString("base64");
}