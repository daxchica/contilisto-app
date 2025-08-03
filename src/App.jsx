// Aoo.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntitiesDashboard from "./pages/EntitiesDashboard";
import PrivateRoute from "./components/PrivateRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { routes } from "./routes";
import BankBookPage from "./pages/BankBookPage";
import LedgerPage from "./pages/LedgerPage";

function App() {
  return (
    <Router>
      <NavBar />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard"
            element={
              <PrivateRoute>
                <EntitiesDashboard />
              </PrivateRoute>
          } />
          <Route path="/libroBancos" element={<BankBookPage />} />
          <Route path="/libro-mayor" element={<LedgerPage />} />

          {routes.map(({ path, element, private: isPrivate }, ix) => (
            <Route
              key={ix}
              path={path}
              element={
                isPrivate ? <PrivateRoute>{element}</PrivateRoute> : element
              }
            />
          ))}
      </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;