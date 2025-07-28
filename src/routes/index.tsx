// routes/index.tsx
import FinancialReports from "../pages/FinancialReports";

export const routes = [
// Dentro de tu definición de rutas
    { 
        path: "/estados-financieros", 
        element:<FinancialReports />,
        private: true,
    }
];