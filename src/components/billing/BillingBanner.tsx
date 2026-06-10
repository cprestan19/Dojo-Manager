"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface BillingStatus {
  status:     string | null;
  isReadOnly: boolean;
}

export function BillingBanner() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then(r => r.ok ? r.json() : null)
      .then((data: BillingStatus | null) => { if (data) setStatus(data); })
      .catch(() => {});
  }, []);

  if (!status) return null;

  if (status.isReadOnly) {
    return (
      <div className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="truncate">
            Tu dojo está en modo lectura. Reactiva tu suscripción para continuar.
          </span>
        </div>
        <Link
          href="/dashboard/billing"
          className="shrink-0 bg-white text-amber-600 font-bold text-xs px-3 py-1 rounded-full hover:bg-amber-50 transition-colors"
        >
          Reactivar
        </Link>
      </div>
    );
  }

  return null;
}
