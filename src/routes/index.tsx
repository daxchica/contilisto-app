// routes/index.tsx
import FinancialStatements from "../pages/FinancialStatements";

export const routes = [
// Dentro de tu definición de rutas
    { 
        path: "/estados-financieros", 
        element:<FinancialStatements />,
        private: true,
    }
];
