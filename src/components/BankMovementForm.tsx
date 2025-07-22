// components/BankMovementForm.tsx
import { useState } from "react";
import { addBankMovement } from "../services/bankMovementService";

export default function BankMovementForm({ entityId }: { entityId: string }) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"ingreso" | "egreso">("ingreso");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description || !amount) {
      alert("Todos los campos obligatorios deben estar llenos.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
        alert("Monto invalido.");
        return;
    }

    setLoading(true);
    try {
        await addBankMovement(entityId, {
            date,
            description, 
            amount: parsedAmount,
            type,
            reference,
            reconciled: false,
        });

        // limpiar formulario
        setDate("");
        setDescription('');
        setAmount("");
        setReference("");
        setType("ingreso");
        alert("Movimiento guardado con exito");
    } catch (err) {
        console.error("Error al guardar movimiento:", err)
        alert("Error al guardar el movimiento");
    } finally {
        setLoading(false);
    }
  };

  return (
    <form 
        onSubmit={handleSubmit} 
        className="bg-white p-4 rounded shadow mb-4"
    >
      <h2 className="text-lg font-bold mb-2">➕ Registrar Movimiento Bancario</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label htmlFor="movement-date" className="block text-sm font-medium text-gray-700">
          Fecha del movimiento
        </label>
        <input
          id="movement-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          required
        />

        <label htmlFor="movement-type" className="block text-sm font-medium text-gray-700">
          Tipo de movimiento
        </label>
        <select
          id="movement-type"
          value={type}
          onChange={(e) => setType(e.target.value as "ingreso" | "egreso")}
          className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </select>
        <input
          type="text"
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          required
        />
        <input
          type="number"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          step="0.01"
          required
        />
        <input
          type="text"
          placeholder="Referencia (opcional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="border p-2 rounded col-span-full focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`mt-4 px-4 py-2 rounded text-white transition-colors ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "Guardando..." : "Guardar Movimiento"}
      </button>
    </form>
  );
}