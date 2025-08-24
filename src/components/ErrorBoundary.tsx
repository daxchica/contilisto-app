import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("💥 Error en ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50">
          {/* Ajusta este pt-20 a la altura real de tu navbar fijo */}
          <div
            className="pt-20 px-4 flex flex-col items-center justify-start"
            role="alert"
            aria-live="assertive"
          >
            <div className="w-full max-w-2xl bg-white border rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">😢 Algo salió mal.</h2>
              <p>{this.state.error?.message}</p>

              {/* Solo en desarrollo mostramos detalles adicionales */}
              {import.meta.env.DEV && (
                <details className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">
                  <summary className="cursor-pointer select-none">
                    Detalles técnicos (DEV)
                  </summary>
                  {String(this.state.error)}
                </details>
              )}

              <div className="mt-6 flex flex-wrap gap-3">

              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
              >
                Recargar la página
              </button>
              <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Volver a intentar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}