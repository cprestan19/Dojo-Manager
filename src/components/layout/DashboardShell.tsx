"use client";
import React, { Component, type ReactNode } from "react";
import { AppContextProvider } from "@/lib/context/AppContext";
import { RefreshCw } from "lucide-react";

/* ─── Error Boundary ────────────────────────────────────────── */
class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-dojo-darker p-8">
          <div className="card max-w-md w-full space-y-4 text-center">
            <p className="text-dojo-red font-semibold text-lg font-display">Error inesperado</p>
            <p className="text-dojo-muted text-sm break-words">
              {(this.state.error as Error).message}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); location.reload(); }}
              className="btn-primary mx-auto"
            >
              <RefreshCw size={15} /> Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Shell: Error Boundary + App Context ─────────────────── */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardErrorBoundary>
      <AppContextProvider>
        {children}
      </AppContextProvider>
    </DashboardErrorBoundary>
  );
}
