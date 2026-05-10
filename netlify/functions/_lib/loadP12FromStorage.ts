// netlify/functions/_lib/loadP12FromStorage.ts
import { getAdminBucket } from "../_server/firebaseAdmin";

export async function loadP12FromStorage(storagePath: string) {
  const file = getAdminBucket().file(storagePath);
  
  const [buffer] = await file.download();
  
  return buffer.toString("base64");
}