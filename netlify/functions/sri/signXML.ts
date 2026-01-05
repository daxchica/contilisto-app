// netlify/functions/sri/signXML.ts
import * as forge from "node-forge";
import { SignedXml } from "xml-crypto";

export interface SignXMLParams {
  xml: string;
  p12Buffer: Buffer;
  p12Password: string;
}

export async function signXML({
  xml,
  p12Buffer,
  p12Password,
}: SignXMLParams): Promise<{ signedXml: string }> {
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(
    p12Asn1, 
    p12Password
  ) as any;

  let privateKeyPem = "";
  let certificatePem = "";

  for (const sc of p12.safeContents as any[]) {
    for (const sb of sc.safeBags as any[]) {
      if (sb.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKeyPem = forge.pki.privateKeyToPem(sb.key);
      }
      if (sb.type === forge.pki.oids.certBag && sb.cert) {
        certificatePem = forge.pki.certificateToPem(sb.cert);
      }
    }
  }

  if (!privateKeyPem || !certificatePem) {
    throw new Error("Certificado P12 inválido");
  }

  const sig = new (SignedXml as any)({
    canonicalizationAlgorithm:
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    signatureAlgorithm:
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  });

  sig.signingKey = privateKeyPem;

  sig.addReference(
    "/*[local-name()='factura']",
    ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    "http://www.w3.org/2001/04/xmlenc#sha256"
  );

  sig.computeSignature(xml);

  return { signedXml: sig.getSignedXml() };
}