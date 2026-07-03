"use client";
import { useEffect } from "react";

export default function ActivityPing() {
  useEffect(() => {
    fetch("/api/user/ping", { method: "PATCH" }).catch(() => null);
  }, []);
  return null;
}
