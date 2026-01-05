export function generateSriInvoiceXml(input: {
  environment: "1" | "2";
  invoice: any;
  entity: any;
}): { xml: string; accessKey: string } {
  // your existing logic
  return {
    xml: "<xml>...</xml>",
    accessKey: "1234567890",
  };
}