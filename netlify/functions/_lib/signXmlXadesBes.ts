// netlify/functions/_lib/signXmlXadesBes.ts
import { SignedXml } from "xml-crypto";
import crypto from "crypto";

function sha256Base64(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("base64");
}
/* ============================================
   XAdES-BES (enveloped) con RSA-SHA256
   ============================================ */
export function signXmlXadesBes(params: {
  xml: string;
  privateKeyPem: string;
  certPem: string;
  certDer: Buffer;
}) {
    const { xml, privateKeyPem, certPem, certDer } = params;

    const signatureId = `SIG-${crypto.randomUUID()}`;
    const signedPropsId = `SP-${crypto.randomUUID()}`;

    const certDigest = sha256Base64(certDer);

    // XAdES Object (mínimo BES)
    const xadesObjectInner = `
    <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${signatureId}">
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
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

    sig.addReference({
        xpath: "/*",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/2001/10/xml-exc-c14n#",
        ],
        digestAlgorithm:
            "http://www.w3.org/2001/04/xmlenc#sha256",
    });
    
    // Reference 2: SignedProperties
  sig.addReference({
    xpath: `//*[@Id='${signedPropsId}']`,
    uri: `#${signedPropsId}`,
    transforms: ["http://www.w3.org/2001/10/xml-exc-c14n#"],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });

  // set "type" manual for XAdES reference (xml-crypto typing limitation)
  (sig as any).references[1].type = "http://uri.etsi.org/01903#SignedProperties";

  sig.computeSignature(xml, {
    location: { reference: "/*", action: "append" },
    prefix: "ds",
    attrs: { Id: signatureId },
  });

  // Insert ds:Object manually
  const signedXml = sig.getSignedXml();
  return signedXml.replace(
    "</ds:Signature>",
    `<ds:Object xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${xadesObjectInner}</ds:Object></ds:Signature>`
  );
}