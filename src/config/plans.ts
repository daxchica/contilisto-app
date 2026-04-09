export type PlanType = "estudiante" | "contador" | "corporativo";

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number;
  stripePriceId?: string;

  limits: {
    maxEntities: number;
    maxInvoicesPerMonth: number;
    maxUsers: number;
  }

  features: {
    aiAccounting: boolean;
    ats: boolean;
    sriReports: boolean;
    multiUser: boolean;
  };
}

export const PLANS: Record<PlanType, PlanConfig> = {
  estudiante: {
    id: "estudiante",
    name: "Estudiante",
    price: 0,
    stripePriceId: undefined,

    limits: {
      maxEntities: 1,
      maxInvoicesPerMonth: 50,
      maxUsers: 1,
    },
    
    features: {
      aiAccounting: true,
      ats: false,
      sriReports: false,
      multiUser: false,
    },
  },

  contador: {
    id: "contador",
    name: "Contador",
    price: 29,
    stripePriceId: "price_contador",

    limits: {
      maxEntities: 5,
      maxInvoicesPerMonth: 500,
      maxUsers: 4,
    },

    features: {
      aiAccounting: true,
      ats: true,
      sriReports: true,
      multiUser: true,
    },
  },

  corporativo: {
    id: "corporativo",
    name: "Corporativo",
    price: 69,
    stripePriceId: "price_corporativo",

    limits: {
      maxEntities: 50,
      maxInvoicesPerMonth: 5000,
      maxUsers: 6,
    },
    
    features: {
      aiAccounting: true,
      ats: true,
      sriReports: true,
      multiUser: true,
    },
  },
};