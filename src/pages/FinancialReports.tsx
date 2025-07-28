// src/pages/FinancialReports.tsx

import { useState, useEffect } from "react";
import { auth } from "../firebase-config";
import IncomeStatement from "../components/IncomeStatement";
import BalanceSheet from "../components/BalanceSheet";
import { getJournalEntries } from "../services/journalService";
import PnLSummary from "../components/PnLSummary";
import AccountsReport from "../components/AccountsReport";

export default function FinancialReports() {
    const [activeTab, setActiveTab] = useState("estado");

    const renderContent = () => {
    switch (activeTab) {
      case "estado":
        return <IncomeStatement />;
      case "balance":
        return <BalanceSheet />;
      default:
        return null;
    }
  };


  return (
    <div className="p-8 gb-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">📊 Estados Financieros</h1>

        {/* Tabs */}
      <div className="flex space-x-4 border-b mb-6">
        <button
          className={`pb-2 font-medium ${
            activeTab === "estado"
              ? "border-b-2 border-blue-700 text-blue-700"
              : "text-gray-500 hover:text-blue-600"
          }`}
          onClick={() => setActiveTab("estado")}
        >
          Estado de Resultados
        </button>
        <button
          className={`pb-2 font-medium ${
            activeTab === "balance"
              ? "border-b-2 border-blue-700 text-blue-700"
              : "text-gray-500 hover:text-blue-600"
          }`}
          onClick={() => setActiveTab("balance")}
        >
          Balance General
        </button>
        
      </div>
        {/* Content */}
      <div className="bg-white shadow rounded p-6">
        {renderContent()}
        </div>
    </div>
  );
}