interface APCardProps {
  value: number;
}

export default function APCard({ value }: APCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <h3 className="text-gray-500 text-sm">Cuentas por pagar</h3>
      <p className="text-3xl font-bold text-orange-600">
        ${value.toFixed(2)}
      </p>
    </div>
  );
};
