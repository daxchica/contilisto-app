interface ARCardProps {
  value: number;
}

export default function ARCard({ value }: ARCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <h3 className="text-gray-500 text-sm">Cuentas por cobrar</h3>
      <p className="text-3xl font-bold text-blue-600">${value.toFixed(2)}</p>
    </div>
  );
};
