"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Detecta cuando el navegador restaura una página desde el BFCache
 * (Back-Forward Cache) al presionar el botón Atrás/Adelante.
 * En ese caso llama a router.refresh() para que Next.js re-solicite
 * los datos más recientes al servidor, evitando mostrar contenido
 * desactualizado después de guardar cambios.
 */
export default function PageRefreshHandler() {
  const router = useRouter();

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) router.refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return null;
}
