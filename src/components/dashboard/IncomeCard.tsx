// src/components/dashboard/IncomeCard.tsx
interface Props {
  value: number;
}

const IncomeCard: React.FC<Props> = ({ value }) => {
  return (
    <div className="dashboard-card">
      <h3 className="dashboard-title">Ingresos</h3>

      <p className="text-3xl font-bold text-green-600">
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>

      <p className="text-sm text-gray-500 mt-2">Total de ingresos registrados</p>
    </div>
  );
};

export default IncomeCard;