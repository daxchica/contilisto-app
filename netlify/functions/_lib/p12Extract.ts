// netlify/functions/_lib/p12Extract.ts
import * as forge from "node-forge";

export function extractP12(p12Buffer: Buffer, password: string) {
  const forgeAny = forge as any;
  const p12Der = forgeAny.util.createBuffer(
    forgeAny.util.binary.raw.encode(p12Buffer)
  );
  const p12Asn1 = forge.asn1.fromDer(p12Der);

  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  return p12;
}