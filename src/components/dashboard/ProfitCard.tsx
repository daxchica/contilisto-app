interface ProfitCardProps {
  value: number;
}

export default function ProfitCard({ value }: ProfitCardProps) {
  const color = value >= 0 ? "text-green-600" : "text-red-600";
  
  return (
    <div className="p-6 bg-white rounded-xl shadow">
      <h3 className="text-gray-500 text-sm font-semibold">GANANCIA</h3>
      <p className={`text-3xl font-bold ${color}`}>${value.toFixed(2)}
      </p>
    </div>
  );
}