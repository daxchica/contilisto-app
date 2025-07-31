export interface BankMovement {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INGRESO" | "EGRESO";
}