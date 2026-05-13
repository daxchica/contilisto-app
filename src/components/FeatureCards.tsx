import { Brain, BadgeDollarSign, Banknote, FileText, BarChart2, Receipt, BookOpen, Building2, ArrowLeftRight } from "lucide-react";

type CardProps = {
  title: string;
  blurb: string;
  Icon: React.ElementType;
  bgColor: string;
  iconBg: string;
  iconColor: string;
  hoverColor: string;
};

function FeatureCard({ title, blurb, Icon, bgColor, hoverColor, iconBg, iconColor }: CardProps) {
  return (
    <div
      className={`group relative rounded-2xl border border-slate-200 ${bgColor} p-4 sm:p-6 shadow-sm ring-1 ring-black/5 transition hover:scale-[1.03] hover:shadow-xl hover:border-transparent hover:${hoverColor}`}
      role="article"
      aria-label={title}
    >
      <div className="relative flex items-start gap-3">
        <div className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor}`} aria-hidden />
        </div>
        <div>
          <h3 className="text-sm sm:text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-700">{blurb}</p>
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
          bgColor="bg-emerald-50"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
          hoverColor="hover:bg-emerald-100"
        />
        <FeatureCard
          title="Facturación Electrónica"
          blurb="Emite, firma y envía facturas electrónicas al SRI desde la plataforma. Cumple con toda la normativa vigente."
          Icon={Receipt}
          bgColor="bg-blue-50"
          iconBg="bg-blue-100"
          iconColor="text-blue-700"
          hoverColor="hover:bg-blue-100"
        />
        <FeatureCard
          title="Estados Financieros"
          blurb="Balance general, estado de resultados y balance de comprobación generados automáticamente."
          Icon={BarChart2}
          bgColor="bg-violet-50"
          iconBg="bg-violet-100"
          iconColor="text-violet-700"
          hoverColor="hover:bg-violet-100"
        />
        <FeatureCard
          title="Cartera"
          blurb="Cuentas por cobrar y pagar con aging, estados por cliente/proveedor y seguimiento de vencimientos."
          Icon={BadgeDollarSign}
          bgColor="bg-indigo-50"
          iconBg="bg-indigo-100"
          iconColor="text-indigo-700"
          hoverColor="hover:bg-indigo-100"
        />
        <FeatureCard
          title="Libro de Bancos"
          blurb="Registra movimientos bancarios, realiza conciliaciones y mantén tus saldos al día con soporte de comprobantes."
          Icon={Banknote}
          bgColor="bg-amber-50"
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
          hoverColor="hover:bg-amber-100"
        />
        <FeatureCard
          title="Declaraciones SRI"
          blurb="Genera anexos transaccionales (ATS) y declaraciones de IVA listas para presentar al SRI."
          Icon={FileText}
          bgColor="bg-rose-50"
          iconBg="bg-rose-100"
          iconColor="text-rose-700"
          hoverColor="hover:bg-rose-100"
        />
        <FeatureCard
          title="Libro Mayor"
          blurb="Consulta los libros auxiliares por cuenta, filtra por fecha y exporta los movimientos contables."
          Icon={BookOpen}
          bgColor="bg-teal-50"
          iconBg="bg-teal-100"
          iconColor="text-teal-700"
          hoverColor="hover:bg-teal-100"
        />
        <FeatureCard
          title="Flujo de Caja"
          blurb="Visualiza entradas y salidas de efectivo, proyecta tu liquidez y toma decisiones con datos en tiempo real."
          Icon={ArrowLeftRight}
          bgColor="bg-cyan-50"
          iconBg="bg-cyan-100"
          iconColor="text-cyan-700"
          hoverColor="hover:bg-cyan-100"
        />
        <FeatureCard
          title="Multi-empresa"
          blurb="Gestiona varias empresas desde una sola cuenta. Cambia de entidad sin cerrar sesión."
          Icon={Building2}
          bgColor="bg-slate-50"
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
          hoverColor="hover:bg-slate-100"
        />
      </div>
    </section>
  );
}