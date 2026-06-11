"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

type ErrorStateProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
};

export function ErrorState({ error, reset, title = "Algo salió mal" }: ErrorStateProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-24 px-4">
      <div className="w-14 h-14 rounded-full bg-dojo-red/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-dojo-red" />
      </div>
      <h1 className="font-display text-xl font-bold text-dojo-white">{title}</h1>
      <p className="text-dojo-muted max-w-sm text-sm">
        Ocurrió un error inesperado. Puedes intentar nuevamente o recargar la página.
      </p>
      <button onClick={reset} className="btn-primary">
        Reintentar
      </button>
    </div>
  );
}
