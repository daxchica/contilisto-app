// ============================================================================
// signXML.ts
// Firma digital XAdES-BES para comprobantes electrónicos del SRI (Factura XML)
// Compatible con certificados .p12 / .pfx (clave privada + certificado)
// Requiere Node >= 18
// ============================================================================

import * as fs from "fs";
import * as forge from "node-forge";

// Firma XML
import {
  SignedXml,
  FileKeyInfo,
  xpath,
} from "xml-crypto";

// ============================================================================
// TIPOS
// ============================================================================

export interface SignXMLParams {
  xml: string;             // XML sin firmar
  p12Buffer: Buffer;       // Archivo .p12 cargado desde FS o Firestore
  p12Password: string;     // Clave del certificado
}

export interface SignedXMLResult {
  signedXml: string;
  certificateInfo: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
  };
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function signXML(params: SignXMLParams): Promise<SignedXMLResult> {
  const { xml, p12Buffer, p12Password } = params;

  // 1) Cargar archivo P12 / PFX
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);

  // 2) Extraer clave privada y certificado
  let privateKeyPem = "";
  let certificatePem = "";
  let certInfo: any = null;

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      // PRIVATE KEY
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
      }

      // CERTIFICATE
      if (safeBag.type === forge.pki.oids.certBag) {
        const cert = safeBag.cert;
        certificatePem = forge.pki.certificateToPem(cert);
        certInfo = {
          subject: cert.subject.attributes
            .map((attr) => `${attr.shortName}=${attr.value}`)
            .join(", "),
          issuer: cert.issuer.attributes
            .map((attr) => `${attr.shortName}=${attr.value}`)
            .join(", "),
          validFrom: cert.validity.notBefore.toISOString(),
          validTo: cert.validity.notAfter.toISOString(),
        };
      }
    }
  }

  if (!privateKeyPem || !certificatePem) {
    throw new Error("No se pudo extraer la clave privada o certificado del archivo .p12");
  }

  // 3) Preparar firmado XML → estándar enveloped signature
  const sig = new SignedXml();

  sig.signingKey = privateKeyPem;

  // Agregar información del certificado
  sig.keyInfoProvider = new FileKeyInfo(certificatePem);
  sig.addReference(
    "//*[local-name(.)='factura']",
    ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    "http://www.w3.org/2001/04/xmlenc#sha256"
  );

  // 4) Firmar XML
  sig.computeSignature(xml);

  const signedXml = sig.getSignedXml();

  return {
    signedXml,
    certificateInfo: certInfo,
  };
}