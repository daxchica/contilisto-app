export type PlanType = "estudiante" | "contador" | "corporativo";

export interface PlanConfig {
  name: string;
  price: number;
  maxEntities: number;
  maxTransactionsPerMonth: number;
  maxUsers: number;
  features: {
    financialReports: boolean;
    bankModule: boolean;
    exportReports: boolean;
    sriReports: boolean;
    electronicInvoicing: boolean;
    advancedDashboard: boolean;
    prioritySupport: boolean;
  };
}

export const PLANS: Record<PlanType, PlanConfig> = {
  estudiante: {
    name: "Estudiante",
    price: 0,
    maxEntities: 2,
    maxTransactionsPerMonth: 100,
    maxUsers: 1,
    features: {
      financialReports: true,
      bankModule: true,
      exportReports: true,
      sriReports: false,
      electronicInvoicing: false,
      advancedDashboard: false,
      prioritySupport: false,
    },
  },

  contador: {
    name: "Contador",
    price: 29,
    maxEntities: 10,
    maxTransactionsPerMonth: 500,
    maxUsers: 3,
    features: {
      financialReports: true,
      bankModule: true,
      exportReports: true,
      sriReports: true,
      electronicInvoicing: true,
      advancedDashboard: false,
      prioritySupport: false,
    },
  },

  corporativo: {
    name: "Corporativo",
    price: 69,
    maxEntities: 999,
    maxTransactionsPerMonth: 99999,
    maxUsers: 10,
    features: {
      financialReports: true,
      bankModule: true,
      exportReports: true,
      sriReports: true,
      electronicInvoicing: true,
      advancedDashboard: true,
      prioritySupport: true,
    },
  },
};