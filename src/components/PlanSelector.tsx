import { PLANS } from "@/config/plans";

export default function PlanSelector({ onSelect }: { onSelect: (plan: string) => void }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {Object.values(PLANS).map((p) => (
        <div key={p.id} className="border rounded-xl p-5 shadow">
          <h2 className="text-lg font-bold">{p.name}</h2>

          <p className="text-2xl mt-2">
            ${p.price} {p.price > 0 && "/mes"}
          </p>

          <ul className="mt-3 text-sm space-y-1">
            <li>📄 Facturas: {p.limits.maxInvoicesPerMonth}</li>
            <li>🏢 Empresas: {p.limits.maxEntities}</li>
            <li>🤖 IA: {p.features.aiAccounting ? "Sí" : "No"}</li>
            <li>📊 ATS: {p.features.ats ? "Sí" : "No"}</li>
          </ul>

          <button
            onClick={() => onSelect(p.id)}
            className="mt-4 w-full bg-blue-600 text-white py-2 rounded"
          >
            Seleccionar
          </button>
        </div>
      ))}
    </div>
  );
}