import { JournalEntry } from "@/types/JournalEntry";

export default function IvaVentasLedger({ entries }: { entries: JournalEntry[] }) {

  const total = entries.reduce(
    (sum, e) => sum + Number(e.credit || 0),
    0
  );

  return (

    <div className="bg-white p-4 rounded shadow">

      <h3 className="font-bold text-lg mb-3">
        IVA Débito en Ventas
      </h3>

      <table className="w-full text-sm border">

        <thead className="bg-gray-100">
          <tr>
            <th>Fecha</th>
            <th>Factura</th>
            <th>Descripción</th>
            <th className="text-right">Crédito</th>
          </tr>
        </thead>

        <tbody>
          {entries.map(e => (
            <tr key={e.id} className="border-t">
              <td className="p-2">{e.date}</td>
              <td>{e.invoice_number}</td>
              <td>{e.description}</td>
              <td className="text-right">
                {Number(e.credit || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot className="bg-gray-100 font-semibold">
          <tr>
            <td colSpan={3}>TOTAL</td>
            <td className="text-right">{total.toFixed(2)}</td>
          </tr>
        </tfoot>

      </table>

    </div>

  );
}