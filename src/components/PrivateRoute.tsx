import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

type PrivateRouteProps = {
  children: JSX.Element;
};

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <p>Checking session...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}