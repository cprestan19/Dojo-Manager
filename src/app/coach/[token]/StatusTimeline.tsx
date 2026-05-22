"use client";
import type { ClubData, TournamentData } from "./CoachPortalClient";

interface Athlete { status: string; categories: { status: string }[] }
interface Props { club: ClubData; tournament: TournamentData; athletes: Athlete[] }

interface Step { label: string; desc: string; done: boolean; active: boolean }

export function StatusTimeline({ club, tournament, athletes }: Props) {
  const approvedAthletes = athletes.filter(a => a.status === "approved").length;
  const totalAthletes    = athletes.length;
  const isPaid           = club.paymentStatus === "paid" || club.paymentStatus === "waived";
  const isApproved       = club.status === "approved";
  const isRejected       = club.status === "rejected";

  const steps: Step[] = [
    {
      label:  "Inscripción recibida",
      desc:   "Tu club ha sido registrado en el torneo.",
      done:   true,
      active: false,
    },
    {
      label:  "Revisión del organizador",
      desc:   isApproved
        ? "El organizador ha aprobado tu inscripción."
        : isRejected
          ? `Rechazada${club.rejectionReason ? `: ${club.rejectionReason}` : "."}`
          : "El organizador está revisando tu solicitud.",
      done:   isApproved,
      active: !isApproved && !isRejected,
    },
    {
      label:  "Pago confirmado",
      desc:   isPaid
        ? "El pago ha sido confirmado. ¡Estás listo!"
        : "Envía tu comprobante de pago en la pestaña 'Pago'.",
      done:   isPaid,
      active: isApproved && !isPaid,
    },
    {
      label:  "Credenciales enviadas",
      desc:   `Recibirás un QR por email para cada atleta aprobado. (${approvedAthletes}/${totalAthletes} atletas aprobados)`,
      done:   approvedAthletes > 0 && isPaid && isApproved,
      active: isPaid && isApproved && approvedAthletes === 0,
    },
    {
      label:  "Listo para el torneo",
      desc:   `Presenta los códigos QR el día del torneo: ${new Date(tournament.date).toLocaleDateString("es", { month: "long", day: "numeric" })}.`,
      done:   false,
      active: approvedAthletes > 0 && isPaid,
    },
  ];

  const border = "rgba(255,255,255,0.1)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: "16px", paddingBottom: "20px", position: "relative" }}>
          {/* Vertical line */}
          {i < steps.length - 1 && (
            <div style={{
              position: "absolute", left: "15px", top: "30px", bottom: 0, width: "2px",
              background: step.done ? "#22c55e" : "rgba(255,255,255,0.1)",
            }} />
          )}
          {/* Dot */}
          <div style={{
            width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: step.done ? "#22c55e" : step.active ? "rgba(192,57,43,0.4)" : "rgba(255,255,255,0.06)",
            border: `2px solid ${step.done ? "#22c55e" : step.active ? "#C0392B" : border}`,
            zIndex: 1,
          }}>
            {step.done ? (
              <span style={{ color: "white", fontSize: "14px", fontWeight: 900 }}>✓</span>
            ) : step.active ? (
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#C0392B", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            ) : (
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>{i + 1}</span>
            )}
          </div>
          {/* Content */}
          <div style={{ paddingTop: "4px", flex: 1, minWidth: 0 }}>
            <p style={{ color: step.done || step.active ? "white" : "rgba(255,255,255,0.35)", fontWeight: 700, fontSize: "14px", margin: 0 }}>
              {step.label}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "3px", lineHeight: 1.5 }}>
              {step.desc}
            </p>
          </div>
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
