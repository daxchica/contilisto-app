import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function Success() {
  const [params] = useSearchParams();

  useEffect(() => {
    const sessionId = params.get("session_id");

    console.log("✅ Payment success:", sessionId);

    // later: fetch session details if needed
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-2">
          🎉 Suscripción exitosa
        </h1>
        <p className="text-gray-600">
          Tu plan ha sido activado correctamente.
        </p>
        <p>Para iniciar a usar Contilisto...</p>
        <p className="text-gray-600">
          Haz click en el link de "Empresas".
        </p>
      </div>
    </div>
  );
}