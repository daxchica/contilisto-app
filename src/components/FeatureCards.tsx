import { Brain, BadgeDollarSign, Banknote } from "lucide-react";

type CardProps = {
  title: string;
  blurb: string;
  Icon: React.ElementType;
  bgColor: string;
  hoverColor: string;
  iconBg: string;
  iconColor: string;
};

function FeatureCard({ title, blurb, Icon, bgColor, hoverColor, iconBg, iconColor }: CardProps) {
  return (
    <div
      className={`group relative rounded-2xl border border-slate-200 ${bgColor} p-6 shadow-sm ring-1 ring-black/5 transition hover:scale-[1.03] hover:shadow-xl hover:border-transparent hover:${hoverColor}`}
      role="article"
      aria-label={title}
    >
      <div className="relative flex items-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-slate-700">{blurb}</p>
        </div>
      </div>
    </div>
  );
}

export default function FeatureCards() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
    >
      <h2 id="features-heading" className="sr-only">
        Funcionalidades principales
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Contabilidad IA"
          blurb="Sube PDFs y la IA genera asientos con PUC Ecuador, IVA y conciliaciones básicas en minutos."
          Icon={Brain}
          bgColor="bg-emeral-50"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
        />
        <FeatureCard
          title="Cartera"
          blurb="Cuentas por cobrar y pagar con aging, estados por cliente/proveedor y recordatorios."
          Icon={BadgeDollarSign}
          bgColor="bg-indigo-50"
          iconBg="bg-indigo-100"
          iconColor="text-indigo-700"
        />
        <FeatureCard
          title="Cuentas Corrientes"
          blurb="Movimientos por banco, conciliaciones y saldos al día con anexos y soporte de comprobantes."
          Icon={Banknote}
          bgColor="bg-amber-50"
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
        />
      </div>
    </section>
  );
}