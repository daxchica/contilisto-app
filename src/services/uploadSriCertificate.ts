// src/services/uploadSriCertificate.ts
import { storage } from "@/firebase-config";
import {
  ref,
  uploadBytes,
  getMetadata,
} from "firebase/storage";

export async function uploadSriCertificate(
  entityId: string,
  file: File
) {
  const path = `entities/${entityId}/sri/certificate.p12`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: "application/x-pkcs12",
  });

  const meta = await getMetadata(storageRef);

  return {
    storagePath: path,
    uploadedAt: new Date().toISOString(),
    // expiresAt will be extracted in backend
  };
}