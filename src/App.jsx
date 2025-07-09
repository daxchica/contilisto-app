// Aoo.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntitiesDashboard from "./pages/EntitiesDashboard";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <NavBar />
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
      </Routes>
    </Router>
  );
}

export default App;