import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import * as forge from "node-forge";
import crypto from "crypto";

/* ===============================
   TYPES
================================ */

type ForgeCertificate = any;
type ForgePrivateKey = any;

type ExtractedP12 = {
  privateKeyPem: string;
  certPem: string;
  cert: ForgeCertificate;
};

/* ===============================
   P12 → PEM
================================ */

export function extractFromP12(
  p12Base64: string,
  password: string
): ExtractedP12 {
  const forgeAny = forge as any;

  try {
    const der = forgeAny.util.decode64(p12Base64);
    const asn1 = forgeAny.asn1.fromDer(der);

    const p12 = forgeAny.pkcs12.pkcs12FromAsn1(asn1, false, password);

    const keyBags =
      p12.getBags({
        bagType: forgeAny.pki.oids.pkcs8ShroudedKeyBag,
      })[forgeAny.pki.oids.pkcs8ShroudedKeyBag] ?? [];

    const certBags =
      p12.getBags({
        bagType: forgeAny.pki.oids.certBag,
      })[forgeAny.pki.oids.certBag] ?? [];

    const keyBag = keyBags[0];
    const certBag = certBags[0];

    if (!keyBag?.key) {
      throw new Error("Private key no encontrada en el archivo P12.");
    }

    if (!certBag?.cert) {
      throw new Error("Certificado no encontrado en el archivo P12.");
    }

    const privateKey: ForgePrivateKey = keyBag.key;
    const cert: ForgeCertificate = certBag.cert;

    return {
      privateKeyPem: forgeAny.pki.privateKeyToPem(privateKey),
      certPem: forgeAny.pki.certificateToPem(cert),
      cert,
    };
  } catch (error: any) {
    throw new Error(
      `No se pudo leer el certificado P12. Verifica la contraseña. ${error.message ?? ""}`
    );
  }
}

/* ===============================
   HELPERS
================================ */

function sha256Base64(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("base64");
}

function validateXml(xml: string): void {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const errors = doc.getElementsByTagName("parsererror");

  if (errors.length > 0) {
    throw new Error("El XML no es válido y no puede ser firmado.");
  }
}

function certToDerBuffer(cert: ForgeCertificate): Buffer {
  const forgeAny = forge as any;
  const certAsn1 = forgeAny.pki.certificateToAsn1(cert);
  const derBytes = forgeAny.asn1.toDer(certAsn1).getBytes();

  return Buffer.from(derBytes, "binary");
}

function cleanCertificatePem(certPem: string): string {
  return certPem
    .replace("-----BEGIN CERTIFICATE-----", "")
    .replace("-----END CERTIFICATE-----", "")
    .replace(/\r?\n|\r/g, "");
}

/* ===============================
   XAdES-BES SIGN
================================ */

export function signXmlXadesBes(params: {
  xml: string;
  privateKeyPem: string;
  certPem: string;
  cert: ForgeCertificate;
}): string {
  const { xml, privateKeyPem, certPem, cert } = params;

  validateXml(xml);

  const signatureId = `SIG-${crypto.randomUUID()}`;
  const signedPropsId = `SP-${crypto.randomUUID()}`;

  const certDer = certToDerBuffer(cert);
  const certDigest = sha256Base64(certDer);
  const certBase64 = cleanCertificatePem(certPem);

  const xadesObject = `
<ds:Object>
  <xades:QualifyingProperties
    xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
    Target="#${signatureId}">
    <xades:SignedProperties Id="${signedPropsId}">
      <xades:SignedSignatureProperties>
        <xades:SigningTime>${new Date().toISOString()}</xades:SigningTime>
        <xades:SigningCertificate>
          <xades:Cert>
            <xades:CertDigest>
              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
              <ds:DigestValue>${certDigest}</ds:DigestValue>
            </xades:CertDigest>
          </xades:Cert>
        </xades:SigningCertificate>
      </xades:SignedSignatureProperties>
    </xades:SignedProperties>
  </xades:QualifyingProperties>
</ds:Object>`;

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

  (sig as any).keyInfoProvider = {
    getKeyInfo: () => `
      <ds:X509Data>
        <ds:X509Certificate>${certBase64}</ds:X509Certificate>
      </ds:X509Data>`,
  } as any;

  sig.addReference({
    xpath: "/*",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });

  sig.computeSignature(xml, {
    location: {
      reference: "/*",
      action: "append",
    },
    prefix: "ds",
    attrs: {
      Id: signatureId,
    },
  });

  const signedXml = sig.getSignedXml();

  return signedXml.replace("</ds:Signature>", `${xadesObject}</ds:Signature>`);
}