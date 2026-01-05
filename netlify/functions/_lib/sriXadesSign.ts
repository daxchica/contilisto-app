import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import * as forge from "node-forge";
import crypto from "crypto";

/* ===============================
   P12 → PEM
================================ */

export function extractFromP12(p12Base64: string, password: string) {
  const der = forge.util.decode64(p12Base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBag = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

  if (!keyBag) throw new Error("Private key no encontrada");

  const certBag = p12.getBags({
    bagType: forge.pki.oids.certBag,
  })[forge.pki.oids.certBag]?.[0];

  if (!certBag) throw new Error("Certificado no encontrado");

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certPem: forge.pki.certificateToPem(certBag.cert),
    cert: certBag.cert,
  };
}

/* ===============================
   Helpers
================================ */

function sha256Base64(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("base64");
}

/* ===============================
   XAdES-BES SIGN
================================ */

export function signXmlXadesBes(params: {
  xml: string;
  privateKeyPem: string;
  certPem: string;
  cert: forge.pki.Certificate;
}): string {
  const { xml, privateKeyPem, certPem, cert } = params;

  const doc = new DOMParser().parseFromString(xml, "text/xml");

  const signatureId = `SIG-${crypto.randomUUID()}`;
  const signedPropsId = `SP-${crypto.randomUUID()}`;

  const certDer = Buffer.from(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
    "binary"
  );

  const certDigest = sha256Base64(certDer);

  const xadesObject = `
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
</xades:QualifyingProperties>`;

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm:
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm:
      "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

  // Documento
  sig.addReference({
    xpath: "/*",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm:
      "http://www.w3.org/2001/04/xmlenc#sha256",
  });

  // SignedProperties (XAdES)
  sig.addReference({
    xpath: `//*[@Id='${signedPropsId}']`,
    uri: `#${signedPropsId}`,
    digestAlgorithm:
      "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  });

  // ⚠️ Hack tipado seguro
  (sig as any).references[1].type =
    "http://uri.etsi.org/01903#SignedProperties";

  sig.computeSignature(xml, {
    location: { reference: "/*", action: "append" },
    prefix: "ds",
    attrs: { Id: signatureId },
  });

  // 🔧 Insertar XAdES manualmente
  const signed = sig.getSignedXml();
  return signed.replace(
    "</ds:Signature>",
    `<ds:Object>${xadesObject}</ds:Object></ds:Signature>`
  );
}