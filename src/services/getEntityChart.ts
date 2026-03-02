// src/services/getEntityChart.ts
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase-config";
import type { Account } from "../types/AccountTypes";
import { fetchEntityAccounts } from "@/services/entityAccountsService";

export async function getEntityChart(entityId: string): Promise<Account[]> {
  return fetchEntityAccounts(entityId);
}