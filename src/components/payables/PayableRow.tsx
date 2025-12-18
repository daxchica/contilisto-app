import React, { useState } from "react";
import type { Payable } from "@/types/Payable";
import PayableInstallmentsTable from "./PayableInstallmentsTable";

type Props = {
  payable: Payable;
  onPay: (payable: Payable) => void;
  onEditTerms: (payable: Payable) => void;
};

export default function PayableRow({
  payable,
  onPay,
  onEditTerms,
}: Props) {
  const [showInstallments, setShowInstallments] = useState(false);

  return (
    <>
      {/* =========================
          MAIN PAYABLE ROW
      ========================== */}
      <tr className="border-t hover:bg-gray-50">
        <td className="p-2">
          <div className="font-medium">{payable.supplierName}</div>
          <div className="text-xs text-gray-500">{payable.supplierRUC}</div>
        </td>

        <td className="p-2">{payable.invoiceNumber}</td>

        <td className="p-2">{payable.issueDate}</td>

        <td className="p-2 text-right font-medium">
          ${payable.balance.toFixed(2)}
        </td>

        <td className="p-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              payable.status === "paid"
                ? "bg-green-100 text-green-700"
                : payable.status === "partial"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {payable.status === "paid"
              ? "Pagado"
              : payable.status === "partial"
              ? "Parcial"
              : "Pendiente"}
          </span>
        </td>

        <td className="p-2 text-right space-x-3 whitespace-nowrap">
          {/* Toggle installments */}
          {payable.installmentSchedule?.length ? (
            <button
              onClick={() => setShowInstallments((v) => !v)}
              className="text-xs text-gray-600 hover:underline"
            >
              {showInstallments ? "Ocultar cuotas" : "Ver cuotas"}
            </button>
          ) : null}

          {/* Pay */}
          <button
            onClick={() => onPay(payable)}
            className="text-xs text-blue-600 hover:underline"
          >
            Pagar
          </button>

          {/* Edit terms */}
          <button
            onClick={() => onEditTerms(payable)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Editar plazos
          </button>
        </td>
      </tr>

      {/* =========================
          INSTALLMENTS (INLINE)
      ========================== */}
      {showInstallments && payable.installmentSchedule && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="p-4">
            <PayableInstallmentsTable
              schedule={payable.installmentSchedule}
            />
          </td>
        </tr>
      )}
    </>
  );
}