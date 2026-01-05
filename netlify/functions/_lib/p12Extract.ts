// netlify/functions/_lib/p12Extract.ts
import forge from "node-forge";

export function extractFromP12Buffer(p12Buffer: Buffer, password: string) {
  const p12Der = forge.util.createBuffer(p12Buffer.toString("binary"));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const keyBag = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

  if (!keyBag) throw new Error("Private key no encontrada en P12");

  const certBag = p12.getBags({
    bagType: forge.pki.oids.certBag,
  })[forge.pki.oids.certBag]?.[0];

  if (!certBag) throw new Error("Certificado no encontrado en P12");

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certPem: forge.pki.certificateToPem(certBag.cert),
    cert: certBag.cert,
  };
}