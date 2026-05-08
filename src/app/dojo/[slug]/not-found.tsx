import Link from "next/link";

export default function DojoNotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A14] text-white flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-6xl">🥋</p>
      <h1 className="text-3xl font-bold">Página no encontrada</h1>
      <p className="text-white/50 max-w-sm">
        Este dojo no tiene una página pública activa o el enlace no es correcto.
      </p>
      <Link href="/" className="px-6 py-3 rounded-full bg-[#C0392B] text-white font-semibold hover:opacity-90 transition-opacity">
        Volver al inicio
      </Link>
    </div>
  );
}
