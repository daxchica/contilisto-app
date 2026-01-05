export async function signXmlDummy(xml: string): Promise<string> {
  return xml.replace(
    "</factura>",
    `<ds:Signature>FIRMA_DUMMY_MVP</ds:Signature></factura>`
  );
}