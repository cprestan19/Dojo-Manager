import { notFound } from "next/navigation";
import { TOURNAMENT_STATUS, JUDGE_ROLES, SCHEDULE_EVENT_TYPES } from "@/lib/utils";
import { PublicRegistrationForm } from "./PublicRegistrationForm";

interface TournamentData {
  id: string;
  name: string;
  date: string;
  location: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  organization: string;
  description: string | null;
  status: string;
  publicSlug: string;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  maxParticipants: number | null;
  organizerName: string | null;
  organizerEmail: string | null;
  organizerPhone: string | null;
  rules: string | null;
  flyerImage: string | null;
  tatamis: { id: string; name: string; color: string; order: number }[];
  scheduleSlots: {
    id: string;
    startTime: string;
    endTime: string | null;
    eventType: string;
    title: string;
    description: string | null;
    tatami: { id: string; name: string; color: string } | null;
  }[];
  judges: { id: string; name: string; role: string; nationality: string | null; tatamiId: string | null }[];
  stream: {
    youtubeVideoId: string | null;
    status: string;
    overlayMessage: string | null;
  } | null;
}

async function getTournament(slug: string): Promise<TournamentData | null> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/public/tournaments/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournament(slug);

  if (!tournament) notFound();

  const statusInfo = TOURNAMENT_STATUS[tournament.status as keyof typeof TOURNAMENT_STATUS];
  const isLive = tournament.stream?.status === "live";
  const isRegOpen = tournament.status === "registration_open";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ padding: "32px", background: "#1a1d27", borderRadius: "16px", border: "1px solid #2d3048", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0", marginBottom: "8px" }}>
                {tournament.name}
              </h1>
              <p style={{ color: "#8892a4", fontSize: "14px" }}>
                {new Date(tournament.date).toLocaleDateString("es-PA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              {(tournament.venue || tournament.location) && (
                <p style={{ color: "#8892a4", fontSize: "14px", marginTop: "4px" }}>
                  📍 {tournament.venue ?? tournament.location}{tournament.city ? `, ${tournament.city}` : ""}{tournament.country ? `, ${tournament.country}` : ""}
                </p>
              )}
            </div>
            <div style={{
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              backgroundColor: statusInfo?.bg ?? "#374151",
              color: statusInfo?.color ?? "#9ca3af",
              border: `1px solid ${statusInfo?.border ?? "transparent"}`,
            }}>
              {statusInfo?.label ?? tournament.status}
            </div>
          </div>

          {tournament.description && (
            <p style={{ marginTop: "20px", color: "#c0c7d4", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
              {tournament.description}
            </p>
          )}

          {tournament.flyerImage && (
            <img src={tournament.flyerImage} alt="Flyer del torneo"
              style={{ marginTop: "20px", maxWidth: "100%", borderRadius: "12px", border: "1px solid #2d3048" }} />
          )}
        </div>

        {isLive && tournament.stream?.youtubeVideoId && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ background: "#1a1d27", borderRadius: "16px", border: "1px solid #c0392b", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#c0392b20" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                <p style={{ color: "#ef4444", fontWeight: "700", fontSize: "14px", letterSpacing: "0.05em" }}>EN VIVO</p>
              </div>
              <div style={{ aspectRatio: "16/9" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${tournament.stream.youtubeVideoId}?autoplay=1`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}

        {isRegOpen && (
          <div style={{ marginBottom: "24px", background: "#1a1d27", borderRadius: "16px", border: "1px solid #2d3048", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f0f0f0", marginBottom: "16px" }}>
              📋 Inscripción en Línea
            </h2>
            <PublicRegistrationForm slug={tournament.publicSlug} maxParticipants={tournament.maxParticipants} />
          </div>
        )}

        {tournament.scheduleSlots.length > 0 && (
          <div style={{ marginBottom: "24px", background: "#1a1d27", borderRadius: "16px", border: "1px solid #2d3048", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f0f0f0", marginBottom: "16px" }}>📅 Programa</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tournament.scheduleSlots.map(slot => {
                const evType = SCHEDULE_EVENT_TYPES[slot.eventType as keyof typeof SCHEDULE_EVENT_TYPES];
                return (
                  <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "#0f1117", borderRadius: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{evType?.icon ?? "📋"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#f0f0f0", fontSize: "14px", fontWeight: "500" }}>{slot.title}</p>
                      {slot.description && <p style={{ color: "#8892a4", fontSize: "12px", marginTop: "2px" }}>{slot.description}</p>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#c0c7d4", fontSize: "13px" }}>
                        {slot.startTime}{slot.endTime ? ` – ${slot.endTime}` : ""}
                      </p>
                      {slot.tatami && (
                        <p style={{ color: "#8892a4", fontSize: "11px", marginTop: "2px" }}>{slot.tatami.name}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tournament.judges.length > 0 && (
          <div style={{ marginBottom: "24px", background: "#1a1d27", borderRadius: "16px", border: "1px solid #2d3048", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f0f0f0", marginBottom: "16px" }}>👥 Panel de Jueces</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
              {tournament.judges.map(judge => {
                const roleInfo = JUDGE_ROLES[judge.role as keyof typeof JUDGE_ROLES];
                return (
                  <div key={judge.id} style={{ padding: "12px", background: "#0f1117", borderRadius: "8px", border: "1px solid #2d3048" }}>
                    <p style={{ color: "#f0f0f0", fontSize: "14px", fontWeight: "500" }}>{judge.name}</p>
                    <p style={{ fontSize: "12px", marginTop: "2px", color: "#8892a4" }}>{roleInfo?.label ?? judge.role}</p>
                    {judge.nationality && <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{judge.nationality}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(tournament.organizerName || tournament.organizerEmail || tournament.organizerPhone) && (
          <div style={{ background: "#1a1d27", borderRadius: "16px", border: "1px solid #2d3048", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f0f0f0", marginBottom: "12px" }}>📞 Información del Organizador</h2>
            {tournament.organizerName && <p style={{ color: "#c0c7d4", fontSize: "14px" }}><strong>Nombre:</strong> {tournament.organizerName}</p>}
            {tournament.organizerEmail && <p style={{ color: "#c0c7d4", fontSize: "14px", marginTop: "6px" }}><strong>Email:</strong> <a href={`mailto:${tournament.organizerEmail}`} style={{ color: "#818cf8" }}>{tournament.organizerEmail}</a></p>}
            {tournament.organizerPhone && <p style={{ color: "#c0c7d4", fontSize: "14px", marginTop: "6px" }}><strong>Teléfono:</strong> {tournament.organizerPhone}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
