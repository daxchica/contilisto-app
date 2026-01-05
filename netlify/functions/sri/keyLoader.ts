export function loadP12FromEnv(): {
  p12Buffer: Buffer;
  password: string;
} {
  if (!process.env.SRI_P12_BASE64 || !process.env.SRI_P12_PASSWORD) {
    throw new Error("Missing SRI certificate env vars");
  }

  return {
    p12Buffer: Buffer.from(process.env.SRI_P12_BASE64, "base64"),
    password: process.env.SRI_P12_PASSWORD,
  };
}