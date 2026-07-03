"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ActivityPing() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/user/ping", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ page: pathname }),
    }).catch(() => null);
  }, [pathname]);

  return null;
}
