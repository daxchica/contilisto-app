// src/types/node-forge.d.ts
declare module "node-forge" {
  export const util: {
    decode64(input: string): string;
  };

  export const asn1: {
    fromDer(input: string): any;
    toDer(obj: any): { getBytes(): string };
  };

  export const pkcs12: {
    pkcs12FromAsn1(asn1: any, password: string): {
      getBags(args: { bagType: string }): Record<string, any[]>;
    };
  };

  export const pki: {
    oids: {
      pkcs8ShroudedKeyBag: string;
      certBag: string;
    };

    privateKeyToPem(key: any): string;
    certificateToPem(cert: any): string;
    certificateToAsn1(cert: any): any;
  };
}