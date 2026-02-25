// src/components/ui/ErrorBoundary.tsx
import React, { PropsWithChildren } from "react";

type ErrorBoundaryProps = PropsWithChildren<{
  fallback?: React.ReactNode;
}>;

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error("UI ErrorBoundary caught:", err);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded">
          Error al mostrar el gráfico.
        </div>
      );
    }
    return this.props.children;
  }
}