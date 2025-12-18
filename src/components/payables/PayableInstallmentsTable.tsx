import type { Installment } from "@/types/Payable";

interface Props {
  schedule: Installment[];
}

export default function PayableInstallmentsTable({ schedule }: Props) {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 italic">
        No existe calendario de pagos
      </div>
    );
  }

  if (!schedule.length) {
    return (
        <div className="p-4 text-sm text-gray-500 italic">
        No existen cuotas definidas para esta factura.
        </div>
    );
    }

  return (
    <div className="bg-gray-50 border-t">
      <table className="w-full text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Cuota</th>
            <th className="p-2">Vence</th>
            <th className="p-2 text-right">Monto</th>
            <th className="p-2 text-right">Pagado</th>
            <th className="p-2 text-right">Saldo</th>
            <th className="p-2">Estado</th>
          </tr>
        </thead>

        <tbody>
          {schedule.map((i) => (
            <tr key={i.index} className="border-t">
              <td className="p-2">#{i.index}</td>
              <td className="p-2">{i.dueDate}</td>
              <td className="p-2 text-right">${i.amount.toFixed(2)}</td>
              <td className="p-2 text-right">${i.paid.toFixed(2)}</td>
              <td className="p-2 text-right">${i.balance.toFixed(2)}</td>
              <td className="p-2">
                {i.status === "paid" ? (
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                    Pagada
                  </span>
                ) : i.status === "partial" ? (
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                    Parcial
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">
                    Pendiente
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}