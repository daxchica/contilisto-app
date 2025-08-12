// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntitiesDashboard from "./pages/EntitiesDashboard";
import PrivateRoute from "./components/PrivateRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import BankBookPage from "./pages/BankBookPage";
import LedgerPage from "./pages/LedgerPage";
import FinancialStatements from "./pages/FinancialStatements";
import { SelectedEntityProvider } from "./context/SelectedEntityContext";

export default function App() {
  return (
    <SelectedEntityProvider>
    <Router>
      <NavBar />
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Private */}
          <Route path="/dashboard" element={<PrivateRoute><EntitiesDashboard /></PrivateRoute>} />
          <Route path="/libroBancos" element={<PrivateRoute><BankBookPage /></PrivateRoute>} />
          <Route path="/libro-mayor" element={<PrivateRoute><LedgerPage /></PrivateRoute>} />
          <Route path="/estados-financieros" element={<PrivateRoute><FinancialStatements /></PrivateRoute>}/>
      </Routes>
      </ErrorBoundary>
    </Router>
    </SelectedEntityProvider>
  );
}