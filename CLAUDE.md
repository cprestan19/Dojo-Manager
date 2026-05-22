# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# DojoManager — Guía de arquitectura y reglas de desarrollo

## Stack
- **Next.js 15** (App Router) · **TypeScript** · **Tailwind CSS 3** · **Prisma 7** · **PostgreSQL**
- **NextAuth 4** (JWT strategy, Credentials provider)
- **@prisma/adapter-pg** — driver adapter para conexión directa a Postgres (requerido por Prisma 7)
- **Cloudinary** — almacenamiento de imágenes (fotos de alumnos) y videos (videos por cinta)
- Variables de entorno en `.env.local` (nunca commitear)

---

## Comandos

```bash
npm run dev            # Servidor de desarrollo
npm run build          # Build de producción (TypeScript y ESLint ignorados — ver next.config.js)
npm run lint           # ESLint (ignorado en build)
npm run typecheck      # tsc --noEmit (verificación de tipos sin emitir)
npm run validate       # tsc + ESLint con --max-warnings 0 (validación completa antes de PR)
npm run db:push        # Sincronizar schema con la BD (usa prisma.config.ts → .env.local)
npm run db:generate    # Regenerar cliente Prisma — reiniciar dev server después
npm run db:studio      # GUI de base de datos (Prisma Studio)
npm run db:migrate     # Nueva migración versionada
```

> **Importante tras `db:generate`**: reiniciar el servidor dev para limpiar el cliente Prisma cacheado en `globalThis`.

Seed inicial (solo una vez, con dev server corriendo):
```bash
curl -X POST http://localhost:3000/api/seed
# Credenciales: admin@dojomanager.com / Admin123!  (rol: sysadmin)
```

---

## Arquitectura Multi-Tenant (SaaS)

```
Dojo  ──┬── User[]
        ├── Student[]   ──┬── Inscription
        │                 ├── Payment[]          (últimos 24 en perfil)
        │                 ├── BeltHistory[]      (últimos 50 en perfil)
        │                 ├── KataCompetition[]  (últimos 50 en perfil)
        │                 ├── Attendance[]
        │                 ├── StudentSchedule[]
        │                 ├── TournamentParticipant[]
        │                 └── TournamentRegistration[]
        ├── Kata[]       ──┬── BeltHistory[]
        │                  └── KataCompetition[]
        ├── Schedule[]   ──── StudentSchedule[]
        ├── Event[]
        ├── DojoPage      (singleton — config página pública)
        ├── DojoOrganization[]
        ├── StoreProduct[]
        ├── FreeTrialRequest[]  (leads de prueba gratis)
        ├── Tournament[] ──┬── TournamentBracket[]
        │                  ├── TournamentParticipant[]
        │                  ├── TournamentMatch[] ── TournamentJudgeScore[]
        │                  ├── TournamentJudge[]
        │                  ├── TournamentReferee[]
        │                  ├── TournamentRegistration[]
        │                  ├── TournamentScheduleSlot[]
        │                  └── TournamentStream (singleton)
        ├── TournamentTatami[] (nivel dojo — reutilizable entre torneos)
        └── (email, slogan, logo, loginBgImage, themeId, locale, tournamentPro, params recordatorios)
```

### Roles
| Rol | Alcance | dojoId en DB |
|-----|---------|-------------|
| sysadmin | Global — gestiona todos los dojos | `null` |
| admin | Su dojo — gestiona usuarios y contenido | requerido |
| user | Su dojo — solo lectura/operaciones básicas | requerido |
| student | Solo portal alumno (`/portal`) | requerido |

### Aislamiento de datos
- **Todas las APIs** filtran por `dojoId` extraído de `session.user.dojoId` (JWT)
- Nunca confiar en `dojoId` del body/query params; siempre desde la sesión
- `sysadmin` no tiene `dojoId` → usa `/api/dojos` para gestión de plataforma

### JWT / Session
El JWT incluye: `id`, `role`, `dojoId`, `mustChangePassword`

---

## Modelos — campos clave

### Student
```prisma
fullName     String   @default("") @map("full_name")  // campo principal — firstName+lastName se mantienen por compatibilidad
studentCode  Int?     @unique           // auto-incremental desde 1000
cedula       String?
fepakaId     String?  @map("fepaka_id")    // ≤15 chars, MAYÚSCULAS
ryoBukaiId   String?  @map("ryo_bukai_id") // ≤15 chars, MAYÚSCULAS
birthDate    DateTime
gender       String
nationality  String
condition    String?                    // condición de salud
bloodType    String?  @map("blood_type")   // O+/O-/A+/A-/B+/B-/AB+/AB-
hasPrivateInsurance Boolean @default(false)
insuranceName       String?
insuranceNumber     String?  @map("insurance_number") // ≤25 chars alfanumérico
motherName   String?
motherPhone  String?
motherEmail  String?
fatherName   String?
fatherPhone  String?
fatherEmail  String?
address      String?  @db.Text
photo        String?  @db.Text         // URL Cloudinary — NUNCA retornar en listas
active       Boolean  @default(true)
attendanceStatus String @default("ACTIVO") @map("attendance_status") // ACTIVO|ALERTA|RIESGO
```
- `fullName` es el campo principal en la UI. `firstName`/`lastName` se guardan también para compatibilidad con búsquedas y APIs heredadas
- `fepakaId` y `ryoBukaiId`: siempre en MAYÚSCULAS (API hace `.toUpperCase()`)
- `studentCode`: `aggregate({ _max: { studentCode } })` + 1, mínimo 1000
- **`photo` NUNCA debe incluirse en queries de lista** — solo en `GET /api/students/[id]`
- `attendanceStatus` se computa cuando se registra asistencia o via batch:
  - `ACTIVO`: asistió en los últimos 3 días
  - `ALERTA`: 3–13 días sin asistencia
  - `RIESGO`: ≥14 días sin asistencia

### Dojo
```prisma
name          String
slug          String   @unique
ownerName     String?
phone         String?
slogan        String?              // eslogan del dojo (usado en SEO de página pública)
email         String?              // FROM address para correos del dojo
instagramUrl  String?  @map("instagram_url")
logo          String?  @db.Text    // URL Cloudinary (o null) — excluir por defecto (?logo=1)
loginBgImage  String?  @db.Text    // URL Cloudinary — imagen de fondo del login mobile
themeId       String   @default("dark-saas") @map("theme_id") // tema visual del panel
locale        String   @default("es") @map("locale")          // "es" | "en" — idioma del panel
tournamentPro Boolean  @default(false) @map("tournament_pro") // Módulo Torneo Pro activado
reminderToleranceDays Int @default(5)
lateInterestPct       Float @default(10.0)
autoRemindersEnabled  Boolean @default(false)
```

### Inscription
```prisma
inscriptionDate   DateTime
annualPaymentDate DateTime?
annualAmount      Float @default(0)
monthlyAmount     Float @default(0)
discountAmount    Float @default(0)
discountNote      String?
paymentPeriod     String @default("monthly") @map("payment_period")  // "monthly" | "biweekly"
biweeklyAmount    Float  @default(0)          @map("biweekly_amount") // monto quincenal (1° y 15)
```
- `paymentPeriod = "biweekly"`: genera pagos cada 15 días (días 1 y 15 del mes)

### BeltHistory
```prisma
beltColor  String
changeDate DateTime
kataId     String?    // kata principal (compat. legacy)
kataIds    Json?      @map("kata_ids")  // string[] — hasta 5 IDs para cintas roja–negra-3-dan
isRanking  Boolean @default(false)
notes      String?
```
- `kataIds`: array JSON de IDs para cintas que requieren múltiples katas (roja hasta negra-3-dan)

### EmailSettings (singleton `id="singleton"`)
```prisma
host, port, user, password (cifrado AES-256), secure, fromName
```
- La contraseña se cifra con `encrypt()` de `src/lib/crypto.ts` antes de guardar
- Se descifra con `decrypt()` al usar — NUNCA retornar al cliente en texto plano
- Las vars de entorno `EMAIL_HOST/PORT/USER/PASS/FROM` son fallback si no hay config en BD

### Kata
- `description` usa valores fijos: `"Kata de Cinta"` | `"Kata de Competencias"` | `null`
- `GET /api/katas` → todas las katas (para gestión)
- `GET /api/katas?active=1` → katas activas en caché 10 min (para modales de selección)
- Invalidar caché con `revalidateTag(CACHE_TAGS.katas(dojoId))` en POST/PUT/DELETE katas

### KataCompetition
Sin `dojoId` directo — filtrar siempre por `student: { dojoId }`.

### DojoPage (singleton por dojo)
```prisma
dojoId       String  @unique
published    Boolean @default(false)
heroTitle    String?
heroSubtitle String?
heroImage    String? @db.Text   // URL Cloudinary
aboutText    String? @db.Text
aboutImage   String? @db.Text  // URL Cloudinary
primaryColor String @default("#C0392B")
showFreeTrial  Boolean @default(true)
showSchedules  Boolean @default(true)
showContact    Boolean @default(true)
showStore      Boolean @default(false)
address      String? @db.Text   // dirección física del dojo
galleryImages Json?              // string[] — URLs Cloudinary
stats        Json?              // { label, value }[]
testimonials Json?              // { name, role, quote, photo? }[]
sensei       Json?              // { name, rank, experience, bio, photo? }
```
- CRUD vía `PUT /api/dojo-page` (upsert). Pública via `GET /api/public/dojo-page?slug=`
- La página se publica/despublica con el campo `published`

### DojoOrganization (organizaciones / federaciones)
```prisma
dojoId  String
name    String       // p.ej. "FEPAKA", "WKF", "Ryo-Bukai"
logoUrl String?      // URL Cloudinary — logo de la federación
order   Int @default(0)
```
- CRUD vía `GET/POST /api/dojo-organizations` y `PUT/DELETE /api/dojo-organizations/[id]`
- Se muestran en la página pública como logos/badges en la sección "Avalado por"

### StoreProduct
```prisma
dojoId      String
name        String
description String?  @db.Text
price       Float
currency    String @default("USD")
imageUrl    String?  @db.Text  // URL Cloudinary
sizes       Json?               // string[] — ["XS","S","M","L","XL"] o null
active      Boolean @default(true)
order       Int     @default(0)
```

### FreeTrialRequest (leads de página pública)
```prisma
dojoId      String
childName   String
childAge    Int
parentName  String
parentPhone String
parentEmail String?
message     String?   @db.Text
status      String @default("pending")  // pending|contacted|scheduled|enrolled|cancelled
scheduleId  String?
notes       String?   @db.Text
read        Boolean @default(false)
```

### Event
```prisma
dojoId      String
title       String
description String?  @db.Text
location    String?
imageUrl    String?  @map("image_url") @db.Text   // URL Cloudinary
startDate   DateTime @map("start_date")
endDate     DateTime @map("end_date")
```
- Eventos activos: `endDate >= new Date()` — pasan a historial automáticamente cuando `endDate < now()`

---

## Módulo de Torneos — Modelos

### Tournament
```prisma
dojoId        String
name          String
date          DateTime
location      String
organization  String
leader1       String
leader2       String?
leader3       String?
tatami        Int?           // número de tatamis del torneo
scheduledAt   DateTime?
description   String?  @db.Text
format        String?  @db.Text @map("tournament_format")
arbitrage     String?  @db.Text
requirements  String?  @db.Text
contact       String?  @db.Text
flyerImage    String?  @db.Text  // URL Cloudinary
// draft | ready | active | completed | confirmed
// Flujo: draft ↔ ready ↔ active → completed ↔ confirmed
// "confirmed" solo sysadmin puede asignarlo. Cambio de estado via selector en header del torneo.
status        String  @default("draft")
bracketLocked Boolean @default(false)
archivedAt    DateTime?   // null = activo; fecha = archivado/historial
registrationOpenAt  DateTime?
registrationCloseAt DateTime?
venue               String?
city                String?
country             String?
maxParticipants     Int?
isPublic            Boolean @default(false)
publicSlug          String? @unique    // para URL pública /public/tournament/[slug]
organizerName       String?
organizerEmail      String?
organizerPhone      String?
rules               String? @db.Text
// Torneos abiertos (v2.0)
tournamentType      String  @default("internal") // "internal"|"open"|"federated"
entryFeePerCategory Float?  // cuota por categoría (torneos abiertos)
feeCurrency         String  @default("USD")
requirePhoto        Boolean @default(false)
requireFederationId Boolean @default(false)
requireWaiver       Boolean @default(true)
waiverText          String? @db.Text
maxAthletesPerClub  Int?
maxTotalAthletes    Int?
// Acreditación (v2.1)
accreditationPin    String? // PIN 4-6 dígitos para scanner de entrada (voluntarios) — NUNCA exponer en APIs públicas
```

### TournamentBracket
```prisma
tournamentId  String
name          String
type          String @default("kumite")  // "kumite" | "kata"
gender        String?   // "M" | "F" | null
order         Int @default(0)
bracketLocked Boolean @default(false)
// Categoría WKF completa (v2.0)
ageGroup       String?  // "mini_4_5"|"mini_6_7"|"infantil_a"|"infantil_b"|"pre_cadete"|"cadete"|"junior"|"sub21"|"senior"|"master35"|"master45"|"open"
weightCategory String?  // "-50kg"|"-55kg"|..."-67kg"|"+84kg"|"open" — null para kata
beltCategory   String?  // "principiantes"|"intermedios"|"avanzados"|"elite" — torneos locales
isTeamKata     Boolean @default(false)  // true = Kata en Equipo (3 atletas)
categoryLabel  String?  // Auto-generado por buildCategoryLabel() — "Kumite Cadete -63kg Masculino"
bracketOrder   Int @default(0)  // Orden de disputa en el tatami
// draft | ready | active | completed
status        String @default("draft")
bracketScheduledAt DateTime?
bracketTatami      Int?
```

### TournamentParticipant
```prisma
tournamentId String
studentId    String
bracketId    String?
seed         Int    @default(0)
weight       Float? // peso en kg del competidor (para overlay de TV)
// QR de acreditación (v2.1)
qrCode           String?   @unique  // generado solo cuando torneo.status=ready/active Y admin confirma lista
accreditedAt     DateTime?           // marcado al escanear en entrada del torneo
credentialSentAt DateTime?
kikenAt          DateTime?           // árbitro marca KIKEN — solo admin autenticado
```
- `@@unique([bracketId, studentId])` — un alumno no puede estar dos veces en el mismo bracket
- `weight`: se ingresa en el dashboard (tab Tatamis & Jueces) y se muestra en el overlay OBS
- `qrCode`: solo se genera cuando el torneo está en `ready`/`active` y el admin confirma la lista — nunca en borrador

### TournamentMatch
```prisma
tournamentId    String
bracketId       String?
tatamiId        String?
round           Int
matchNumber     Int
participant1Id  String?
participant2Id  String?
score1          Int?
score2          Int?
winnerId        String?
isBye           Boolean @default(false)
senshu          String?   // participantId del primer anotador (regla de desempate)
// Hantei (判定) — decisión por empate
hanteiStatus     String @default("none")   // "none"|"called"|"voting"|"decided"
hanteiWinnerId   String?
hanteiVotesAo    Int @default(0)
hanteiVotesAka   Int @default(0)
hanteiCalledAt   DateTime?
hanteiDecidedAt  DateTime?
```
- `hanteiStatus`: ciclo `none → voting → decided`. Se llama cuando score1===score2 y senshu es null.
- Solo Kumite usa Hantei. Kata no aplica.

### TournamentJudgeScore ⚠️ Modelo de puntuación por juez
```prisma
matchId      String
judgeId      String
tatamiId     String?
scoreType    String @default("kumite")  // "kumite" | "kata"

// Kumite — técnicas individuales (para pantalla TV)
ippon1   Int @default(0)    // 3 pts
wazaari1 Int @default(0)    // 2 pts
yuko1    Int @default(0)    // 1 pt
ippon2   Int @default(0)
wazaari2 Int @default(0)
yuko2    Int @default(0)

// Kumite — totales calculados (ippon*3 + wazaari*2 + yuko*1)
score1   Float @default(0)
score2   Float @default(0)

// Kumite — penalizaciones
chukoku1 Int @default(0)    // advertencia leve (C)
hansoku1 Int @default(0)    // descalificación (H)
chukoku2 Int @default(0)
hansoku2 Int @default(0)
penalty1 Int @default(0)    // total penalizaciones C1
penalty2 Int @default(0)    // total penalizaciones C2

// Última técnica (para display TV)
lastTechnique1 String?   // "ippon"|"wazaari"|"yuko"|"chukoku"|"hansoku"
lastTechnique2 String?

// Kata — nota del juez
kataScore1 Float?
kataScore2 Float?
```
- `@@unique([matchId, judgeId])` — un juez solo puntúa una vez por combate

### TournamentJudge
```prisma
tournamentId String
dojoId       String
tatamiId     String?   // tatami asignado
name         String
role         String @default("judge")
licenseNo    String?
nationality  String?
active       Boolean @default(true)
```

### TournamentReferee
```prisma
tournamentId String
name         String
order        Int @default(0)
```

### TournamentTatami
```prisma
tournamentId String
dojoId       String
name         String
order        Int @default(0)
color        String @default("#C0392B")
active       Boolean @default(true)

// Streaming por tatami
youtubeVideoId   String?
youtubeStreamKey String?  @db.Text
streamStatus     String @default("offline")  // offline|live|finished
overlayMessage   String?  @db.Text

// Match activo en este tatami (para overlay y scoreboard real-time)
currentMatchId        String?
currentMatchStartedAt DateTime?    // marca de inicio del Sencho
matchTimerRunning     Boolean @default(false)
matchTimerBaseElapsed Int     @default(0)      // segundos acumulados antes de la última pausa
matchDurationSecs     Int     @default(120)    // duración total del match en segundos (default 2:00)

// Display TV — máquina de estados (v2.0)
matchDisplayState    String    @default("idle")
// "idle" | "active" | "winner" | "next_preview"
winnerParticipantId  String?   // set cuando matchDisplayState = "winner"
winnerReason         String?   // "points"|"ippon"|"wazaari"|"hansoku"|"kiken"|"senshu"
matchWonAt           DateTime? // al setearse, display inicia cuenta regresiva 10s → next_preview

// Overlay OBS parametrizable (v2.0)
overlayWidth   Int    @default(1920)
overlayHeight  Int    @default(1080)
overlayScale   Float  @default(1.0)
overlayPreset  String @default("1920x1080")
// "1920x1080"|"1280x720"|"3840x2160"|"1080x1920"|"1366x768"
```
- Nivel dojo: los tatamis son recursos del dojo reutilizables entre torneos
- `matchDisplayState`: controla la pantalla TV y el overlay — cambiar con `PUT /api/tournaments/[id]/tatami/[tatamiId]/display-state`

### TournamentStream (singleton por torneo)
```prisma
tournamentId    String @unique
dojoId          String
youtubeVideoId  String?
youtubeStreamKey String? @db.Text
title           String?
description     String? @db.Text
thumbnailUrl    String?
status          String @default("offline")
overlayMessage  String?
activeOverlay   String @default("logo")   // overlay activo en la pantalla principal
startedAt       DateTime?
endedAt         DateTime?
```

### TournamentScheduleSlot
```prisma
tournamentId String
dojoId       String
tatamiId     String?
startTime    String
endTime      String?
eventType    String
title        String
description  String?
order        Int @default(0)
```

### TournamentRegistration (inscripciones federativas públicas)
```prisma
tournamentId   String
dojoId         String
studentId      String?   // alumno del dojo (opcional)
guestFirstName String?   // datos de atleta externo
guestLastName  String?
guestDojo      String?
guestBelt      String?
guestBirthDate DateTime?
guestEmail     String?
guestPhone     String?
categories     String    // categorías inscritas
status         String @default("pending")  // pending|approved|rejected
approvedAt     DateTime?
approvedBy     String?
notes          String?
```

---

## Módulo Torneos Abiertos (v2.0) — Nuevos Modelos

### ExternalClub (clubs visitantes)
```prisma
tournamentId  String
dojoId        String   // dojo ANFITRIÓN — SIEMPRE presente
clubName      String
country       String?
city          String?
coachName     String
coachEmail    String
coachPhone    String?
federationId  String?
accessToken   String @unique   // JWT firmado 30 días (coach-token.ts) — NUNCA exponer al organizador
accessExpires DateTime
status        String @default("pending")  // "pending"|"approved"|"rejected"|"waitlist"
paymentStatus String @default("unpaid")  // "unpaid"|"partial"|"paid"|"waived"
paymentRef    String?
paymentProofUrl String? @db.Text   // URL Cloudinary del comprobante
paidAt        DateTime?
rejectionReason String? @db.Text
notes         String?  @db.Text
```
- `accessToken`: generado con `generateCoachToken()` de `src/lib/coach-token.ts`
- Cuando `status=approved` AND `paymentStatus=paid|waived` → se generan QRs de atletas y se envían credenciales

### ExternalAthlete (atletas de clubs visitantes)
```prisma
tournamentId   String
dojoId         String   // dojo anfitrión — SIEMPRE
externalClubId String
firstName      String
lastName       String
documentId     String?
birthDate      DateTime
gender         String   // "M"|"F"
nationality    String?  // código ISO "PA","CO","MX"
weight         Float?
beltColor      String?
fepakaId       String?
photoUrl       String?  @db.Text  // URL Cloudinary
ageGroup       String?  // calculado con calculateAgeGroup() al guardar
status         String @default("pending")  // "pending"|"approved"|"rejected"|"withdrawn"
waiverSigned   Boolean @default(false)
waiverSignedAt DateTime?
waiverIp       String?
// Acreditación QR
qrCode           String? @unique  // generado solo cuando club.status=approved Y club.paymentStatus=paid|waived
accreditedAt     DateTime?
credentialSentAt DateTime?
kikenAt          DateTime?   // árbitro marca KIKEN — solo admin autenticado puede setearlo
bracketId        String?     // asignado post-aprobación
```
- `qrCode` se genera en `POST /api/tournaments/[id]/external-clubs/[clubId]/send-credentials`
- Nunca incluir `documentId` ni `photoUrl` en queries de lista

### ExternalAthleteCategory (inscripción por categoría)
```prisma
tournamentId  String
dojoId        String   // dojo anfitrión — SIEMPRE
athleteId     String
bracketId     String?
categoryLabel String
status        String @default("pending")  // "pending"|"approved"|"rejected"|"waitlist"|"withdrawn"
rejectionReason String? @db.Text
feeAmount     Float?
paymentStatus String @default("unpaid")  // "unpaid"|"paid"|"waived"
// Ranking/seeding (v2.1)
isRanking         Boolean @default(false)  // coach lo marca al inscribir
rankingValidated  Boolean?  // null=pendiente, true=validado, false=rechazado
rankingNote       String?   // nota del coach ("Campeón Nac. 2024") o del organizador
rankingSeed       Int?      // asignado por organizador: 1=cabeza de serie, máx 4 por bracket
bracketSeed       Int?
bracketPosition   Int?
approvedAt        DateTime?
approvedBy        String?
```
- `isRanking`: coach lo marca al seleccionar categoría → organizador valida → `rankingSeed` asignado
- Atletas con `rankingSeed` se distribuyen en el bracket para no enfrentarse hasta semifinal (ver `tournament-seeding.ts`)

### HanteiVote (voto individual de cada juez en empate)
```prisma
matchId      String
judgeId      String
tournamentId String
dojoId       String   // SIEMPRE presente — isolación multi-tenant
vote         String   // "ao" | "aka"
isReferee    Boolean @default(false)  // árbitro principal — desempata en 2-2
votedAt      DateTime @default(now())
@@unique([matchId, judgeId])  // un juez, un voto por combate
```
- Votos individuales NUNCA se revelan al público — solo el conteo total, hasta `hanteiStatus="decided"`
- `isReferee=true` cuando `judge.role ∈ {"referee","chief_referee","shushin"}`

---

## Cintas disponibles (BELT_COLORS en utils.ts)
```
blanca → blanca-celeste → blanco-amarillo → amarilla → naranja → verde →
azul → morada → roja → café → café-1-raya → café-2-rayas → café-3-rayas →
negra → negra-1-dan → negra-2-dan → negra-3-dan
```
- `blanca-celeste` hex `#87CEEB`, `blanco-amarillo` hex `#FFE566`
- Siempre usar los `value` del array, no strings arbitrarios

---

## Rutas de la aplicación

### Públicas (sin auth)
```
/                                    → Landing page principal — vende el producto DojoManager
/register                            → Registro público de usuarios
/dojo/[slug]                         → Página pública del dojo (solo si published=true)
                                       Acepta ?preview=1 para admin logueado (preview antes de publicar)
/dojo/[slug]/login                   → Login exclusivo del dojo (branding propio)
/public/tournament/[slug]            → Vista pública de torneo + inscripciones federativas
/public/tournament/[slug]/scoreboard → Marcador público del torneo
/tournament/[id]/overlay             → Selector de tatamis con URLs para OBS (requiere login)
/tournament/[id]/overlay/[tatamiId]  → Overlay OBS por tatami (sin auth) — muestra competidores, timer, puntaje
/tournament/[id]/tatami/[tatamiId]/display → Pantalla de tatami (TV/display en sala)
                                       Estados: idle|active|winner|next_preview (matchDisplayState)
                                       Banner "📹 VIDEO REVIEW" cuando match.reviewStatus ≠ "none"
/tournament/[id]/judge               → Interfaz de juez (app real-time para puntuar)
                                       Incluye botón "📹 Solicitar Video Review" (si videoReviewEnabled=true en tatami)
/tournament/[id]/accredit            → Scanner de acreditación en entrada (sin NextAuth, requiere PIN)
                                       Valida QRs de atletas, muestra estado OK/WARNING/ERROR

### Portal del Coach (sin NextAuth — acceso por JWT)
```
/coach/[token]                       → Portal del coach externo (standalone, sin layout dashboard)
                                       Tabs: Mis Atletas | Pago | Estado | Info del torneo
                                       Token JWT firmado 30 días (coach-token.ts)
                                       Headers: Cache-Control: no-store, X-Robots-Tag: noindex
```
```

### Dashboard (roles: sysadmin / admin / user)
```
/login                               → Login (acepta ?dojo=slug, muestra bg image si configurada)
/forgot-password                     → Solicitud de recuperación de contraseña
/reset-password                      → Reseteo de contraseña con token
/dashboard                           → Inicio/métricas         [Server Component]
/dashboard/change-password           → Cambio obligatorio de contraseña
/dashboard/students                  → Alumnos [Server+Client] filtros: búsqueda, activo/inactivo, cinta
/dashboard/students/new              → Nuevo alumno
/dashboard/students/[id]             → Perfil alumno — activo/desactivar + historial completo + acceso portal
/dashboard/students/[id]/edit        → Editar alumno           [Server Component]
/dashboard/payments                  → Pagos + recordatorios + recibos + generación mensual
/dashboard/belts                     → Historial de rangos (todos los alumnos)
/dashboard/schedules                 → Horarios de clases (CRUD)
/dashboard/attendance                → Registro de asistencia (con fotos, link a perfil)
/dashboard/tournaments               → Redirect → /dashboard/tournaments-pro
/dashboard/tournaments/[id]          → Redirect → /dashboard/tournaments-pro/[id]
/dashboard/tournaments/new           → Redirect → /dashboard/tournaments-pro/new
/dashboard/tournaments-pro           → Torneos Pro — lista de torneos [feature-gated tournamentPro]
/dashboard/tournaments-pro/new       → Crear torneo (único formulario de creación)
/dashboard/tournaments-pro/[id]      → Gestión del torneo Pro (brackets, matches, tatamis, jueces)
/dashboard/events                    → Eventos [Client] CRUD con imagen Cloudinary + vista previa
/dashboard/leads                     → CRM de Prospectos — pruebas gratis solicitadas desde la web
/dashboard/store                     → Tienda del dojo — catálogo de productos
/dashboard/katas                     → Catálogo de katas [solo lectura — sub-menú Configuración]
/dashboard/reports                   → Reportes
/dashboard/users                     → Usuarios del dojo
/dashboard/dojos                     → Gestión de dojos (sysadmin)
/dashboard/audit-log                 → Log de auditoría (sysadmin)
/dashboard/settings                  → Config general (logo, email dojo, params pago, bg login, idioma)
/dashboard/settings/public-page      → Editor de página pública del dojo
/dashboard/settings/katas            → Creación y gestión de katas [CRUD]
/dashboard/settings/videos           → Videos por cinta (CRUD)
/dashboard/settings/email            → Parámetros de correo SMTP (admin + sysadmin)
/dashboard/settings/roles            → Roles y accesos (permisos granulares)
/scanner                             → Scanner QR con cámara html5-qrcode (mobile-first)
```

### Portal alumno (rol: student)
```
/portal                              → Inicio del alumno (perfil, cinta actual)
/portal/change-password              → Cambio obligatorio de contraseña
/portal/payments                     → Historial de pagos propios
/portal/attendance                   → Historial de asistencia propia
/portal/schedules                    → Horarios asignados
/portal/videos                       → Videos de katas — solo cintas obtenidas
/portal/events                       → Eventos del dojo [Client] tabs: Próximos / Historial
/portal/live                         → Tatamis en vivo — grid de streams activos (v2.0)
/portal/live/[tatamiId]              → Reproductor YouTube embed del tatami (v2.0)
                                       NO expone streamKey — solo youtubeVideoId
```
- El middleware redirige `role === "student"` desde `/dashboard` → `/portal`
- `PortalNav.tsx` en `src/app/portal/` maneja la navegación

**Cada ruta del dashboard tiene `loading.tsx`** con skeleton.

### Sidebar / MobileNav — navegación
Ítems principales (filtrados por permiso `NavKey`):
`Dashboard · Alumnos · Prospectos · Asistencia · Pagos · Cintas o Grados · Torneos · Katas · Eventos · Tienda · Reportes · Usuarios · Dojos · Audit Log`

- **Configuración** es grupo expandible con sub-ítems:
  - General → `/dashboard/settings`
  - Página Pública → `/dashboard/settings/public-page` (admin/sysadmin)
  - Videos de Katas → `/dashboard/settings/videos` (admin/sysadmin)
  - Correo / Notificaciones → `/dashboard/settings/email` (admin/sysadmin)
  - Roles y Accesos → `/dashboard/settings/roles` (admin/sysadmin)
- Se auto-expande cuando `pathname.startsWith("/dashboard/settings")`
- **MobileNav**: muestra 6 ítems simplificados + botón ← cuando no es `/dashboard`
- **Torneos Pro**: ítem en sidebar con popup "Torneo Pro" (lock) si el dojo no tiene `tournamentPro=true`
- **KATAS_CATALOG** (`"katas"`) aparece en el menú como sub-ítem de Configuración o ítem separado según config

---

## Sistema de Temas (Theming)

### 3 temas disponibles
| ID | Nombre | Sidebar | Fondo |
|---|---|---|---|
| `dark-saas` | Dark Premium (default) | `#111827` oscuro | `#0B0F14` |
| `soft-neutral` | Light Minimal | `#FFFFFF` blanco | `#F9FAFB` |
| `executive-red` | Ejecutivo | `#111111` negro | `#F8FAFC` |

### Variables CSS (en `src/styles/themes.css`)
- `--c-bg`, `--c-sidebar`, `--c-card`, `--c-border`, `--c-text-1`, `--c-text-2`, `--c-primary`
- `--c-sidebar-text`, `--c-sidebar-muted` — texto sobre el sidebar (siempre claro en sidebars oscuros)
- `--c-nav-active` — color del ítem activo del menú (gris en dark-saas, rojo en executive-red)
- `--c-primary-hex` — color primario en formato hex (para colores de gráficos Recharts en JS)

### Tokens Tailwind (`tailwind.config.ts`)
`dojo-darker`, `dojo-dark`, `dojo-card`, `dojo-border`, `dojo-white`, `dojo-muted`,
`dojo-sidebar-text`, `dojo-sidebar-muted`, `dojo-nav-active`, `dojo-red`, `dojo-gold`

Todos usan formato `rgb(var(--c-x) / <alpha-value>)` → soportan modificadores de opacidad (`bg-dojo-card/40`).

### Reglas de uso
- **En sidebar/topbar/drawer**: usar `text-dojo-sidebar-text` y `text-dojo-sidebar-muted` (siempre legible)
- **En contenido principal**: usar `text-dojo-white` (se adapta a fondo oscuro o claro según tema)
- **Ítem activo nav**: `bg-dojo-nav-active text-white` (nunca hardcodear color)
- **NUNCA** usar `bg-[#1e3a5c]` u otros hex hardcodeados para estados activos

### Cambio de tema
- Admin guarda tema en DB (`dojo.themeId`) vía `PUT /api/dojo/theme`
- SSR lee `themeId` desde DB y aplica `data-theme` al `<div id="dojo-shell">`
- Cliente: `useTheme()` hook lee el `data-theme` actual del DOM y lo actualiza en `#dojo-shell`
- `ThemeSwitcher` en TopBar (solo admin/sysadmin)

---

## Internacionalización (i18n)

### Locales soportados
| Locale | Nombre |
|--------|--------|
| `es` | Español (default) |
| `en` | English |

### Estructura
- `src/lib/i18n.ts` — traducciones estáticas `{ es: {...}, en: {...} }`, función `getT(locale)`
- `src/lib/hooks/useLocale.ts` — hook cliente: `useLocale()` → `{ locale: string; t: Translations }`
- `Dojo.locale` — locale guardado en BD por dojo; se actualiza en `/dashboard/settings`

### Secciones de traducción (`Translations`)
```typescript
{
  nav:      Record<string, string>  // etiquetas del sidebar/MobileNav
  topbar:   Record<string, string>  // títulos de páginas en TopBar
  common:   Record<string, string>  // save, cancel, delete, etc.
  settings: Record<string, string>  // etiquetas de configuración
}
```
- `useLocale()` obtiene el locale desde `useDojo().locale` (AppContext) → llama `getT(locale)`
- Los componentes de layout (Sidebar, TopBar, MobileNav) usan `useLocale()` para textos

---

## AppContext (`src/lib/context/AppContext.tsx`)

Provider global que comparte en el dashboard:
- `dojoInfo`: `{ id, name, slug, logo, locale, tournamentPro, ... }` (cargado una vez al montar)
- `permissions`: `Set<NavKey>` del usuario actual

Hooks que lo consumen:
- `useDojo()` → `DojoInfo | null`
- `usePermissions()` → `Set<NavKey>`
- `useLocale()` → `{ locale: string; t: Translations }` (depende de useDojo)

`useDojo` retorna:
```typescript
{
  id: string
  name: string
  slug: string
  logo: string | null
  ownerName: string | null
  phone: string | null
  slogan: string | null
  active: boolean
  locale: "es" | "en"
  tournamentPro: boolean
}
```

---

## Feature Gate — Torneo Pro

- `Dojo.tournamentPro` (boolean, default `false`) controla el acceso al módulo de torneos
- `sysadmin` siempre tiene acceso completo (ignora el flag)
- Cuando `tournamentPro = false`: el ítem en sidebar muestra popup de "upgrade"
- Cuando `tournamentPro = true`: acceso completo a `/dashboard/tournaments-pro/`
- El sysadmin activa el flag desde `/dashboard/dojos` (gestión de plataforma)
- **`TOURNAMENTS` NAV_KEY está excluido de `ALL_DOJO_KEYS`** — la gestión de torneos es feature-gated, no un permiso granular

---

## Sistema Real-time de Tatamis (Torneos Pro)

### Flujo de un combate
1. Admin cambia estado del torneo a `ready` o `active` (selector en header del torneo)
2. Admin asigna tatami al bracket → jueces se conectan a `/tournament/[id]/judge`
3. Tab "En Vivo" → sección tatami → dropdown **"★ COMBATE ACTIVO EN PANTALLA"** → selecciona match
   - Llama `PUT /api/tournaments/[id]/tatami/[tatamiId]/active-match { matchId }`
4. Jueces puntúan técnicas en tiempo real → `PUT /api/tournaments/[id]/matches/[matchId]/judge-scores`
5. Timer controlado desde la app del juez → `PUT /api/tournaments/[id]/tatami/[tatamiId]/timer`
6. Display en TV/pantalla → `/tournament/[id]/tatami/[tatamiId]/display`
7. Overlay OBS → abrir `/tournament/[id]/overlay` (logueado) → copiar URL → pegar en OBS
   - Browser Source OBS: **1920×1080px**, activar "Enable Background Transparency"
   - El overlay muestra: nombre tatami, categoría, timer countdown, tarjetas AO/AKA con avatar+nombre+dojo+bandera+peso+puntaje
8. Scoreboard público → `/public/tournament/[slug]/scoreboard`

### Stream status de tatami (`TournamentTatami.streamStatus`)
- `offline` → `live` → `finished` → puede reiniciarse a `offline` con botón "↺ Reiniciar"
- El badge "EN VIVO" en el overlay solo aparece cuando `streamStatus === "live"`
- Los datos del combate se muestran **independientemente** del streamStatus

### Display TV — Máquina de estados implementada
`TournamentTatami.matchDisplayState` → cambiar con `PUT /api/tournaments/[id]/tatami/[tatamiId]/display-state`

| Estado | Pantalla TV | OBS Overlay |
|---|---|---|
| `idle` | Pantalla de espera (logo + nombre tatami) | Solo nombre tatami |
| `active` | Combate activo (kumite/kata) + banner review si aplica | Tarjetas AO/AKA + timer |
| `winner` | Celebración ganador (foto, 🏆, razón victoria, confetti) | Tarjetas normales |
| `next_preview` | "⏭ PRÓXIMO COMBATE" | Tarjetas normales |

- Banner "📹 VIDEO REVIEW EN PROCESO" aparece en pantalla TV y overlay OBS cuando `match.reviewStatus ∈ {requested, reviewing}`
- Estado `winner` incluye contador de segundos transcurridos desde `matchWonAt`
- `getWinnerReasonText(reason)` convierte código de victoria a texto legible

### Video Review — flujo completo implementado
1. Admin activa **Video Review** en tab "En Vivo" → sección del tatami → toggle "📹 Video Review activado"
   - Campo `obsRecordingPath` (texto informativo): ruta donde OBS graba el archivo local (ej. `C:/OBS/Recordings/TatamiA/`)
   - Ambos campos se guardan en `TournamentTatami` via `PUT /api/tournaments/[id]/tatami/[tatamiId]/stream`
2. Árbitro pulsa "📹 Solicitar Video Review" en la app del juez (requiere PIN + `videoReviewEnabled=true`)
3. `POST /api/tournaments/[id]/matches/[matchId]/video-review { pin, requestedBy }` — pausa timer automáticamente
4. Pantalla TV y overlay OBS muestran banner azul "VIDEO REVIEW EN PROCESO"
5. Árbitro abre `/tournament/[id]/tatami/[tatamiId]/review` → ingresa PIN → ve video + segundo exacto + instrucción OBS
6. `PUT .../video-review { pin, decision, notes? }` — registra decisión
7. Combate se reanuda

### App del Juez — flujo de categoría (Phase 4.7)
Flujo implementado entre "seleccionar juez" y "puntuar":

1. **Pantalla de categoría** (nueva): muestra la categoría activa en el tatami del juez
   - Sin combate activo: pantalla de espera animada
   - Con combate activo: nombre del bracket (grande), round, match#, tarjetas AO/AKA, botón "Comenzar a puntuar →"
2. **Pantalla de puntuación**: header ahora muestra `"Kumite Cadete -63kg · R2 #3"` en lugar de solo el tatami
   - Botón "← Cat." para volver a la pantalla de categoría
   - Si el torneo cambia de bracket (nueva categoría), regresa automáticamente a la pantalla de categoría

### Sistema Hantei (判定) — decisión por empate en Kumite

**Contexto WKF**: Se llama cuando el combate termina con score1===score2 y sin Senshu. El árbitro llama "Hantei" y el panel (árbitro + jueces) vota simultáneamente AO o AKA. Mayoría simple gana; en empate 2-2, el árbitro tiene el voto de desempate.

**Flujo:**
1. `requiresHantei(match)` detecta empate total — se valida server-side, no se puede forzar
2. Admin (árbitro) llama `POST /api/tournaments/[id]/matches/[matchId]/hantei` → `hanteiStatus = "voting"`
3. App del juez reemplaza pantalla de puntuación con **dos botones grandes AO/AKA**
4. Cada juez llama `POST .../hantei/vote { judgeId, vote }` → voto registrado en `HanteiVote`
5. Pantalla TV muestra banner dorado "⚖️ H A N T E I" mientras se vota
6. Admin llama `POST .../hantei/decide` → sistema calcula ganador → `hanteiStatus = "decided"`
7. Pantalla TV muestra ganador con círculos de votos (●=AO, ●=AKA)
8. Overlay OBS muestra banner "⚖️ HANTEI" durante la votación

**Utilidad `src/lib/hantei.ts`:**
- `requiresHantei(match)` — valida empate total (score igual, sin senshu, sin ganador, no bye)
- `calculateHanteiResult(votes, p1Id, p2Id, totalExpected, force?)` — mayoría simple → árbitro desempata en 2-2
- `getHanteiDisplayText(result)` — texto para TV/overlay
- `HANTEI_PANEL_SIZES` — estándar (4), pequeño (3), mínimo (1)

**APIs:**

| Ruta | Método | Auth | Descripción |
|---|---|---|---|
| `.../hantei` | `GET` | público | Estado + conteo de votos (sin revelar individuales) |
| `.../hantei` | `POST` | admin | Árbitro llama el Hantei |
| `.../hantei/vote` | `POST` | judgeId | Juez emite su voto ao/aka |
| `.../hantei/decide` | `POST` | admin | Cerrar votación + registrar ganador + logAudit |

**Seguridad:**
- `HanteiVote.dojoId` siempre presente
- `@@unique([matchId, judgeId])` — un juez, un voto
- Votos individuales no se revelan hasta `decided`
- `requiresHantei()` validado server-side antes de iniciar
- `logAudit()` en `HANTEI_CALLED` y `HANTEI_DECIDED`

### Generación de brackets — seeding integrado
`POST /api/tournaments/[id]/brackets/[bracketId]/bracket` ahora respeta los seeds:
- Si algún participante tiene `TournamentParticipant.seed > 0` → usa `distributeParticipantsWithSeeds()` con posiciones WKF fijas
- Si ninguno tiene seed → shuffle aleatorio (comportamiento original)
- Seeds 1-4: posiciones fijas (WKF), seeds 5+ se tratan como no-seed

### Página pública del torneo (torneos abiertos)
`/public/tournament/[slug]` incluye sección de inscripción de clubs cuando `tournamentType = "open"`:
- Countdown al cierre de inscripciones
- Cuota por categoría y máximo de atletas
- Botón "📝 Inscribir mi Club" → formulario → `POST /api/public/tournaments/[slug]/register-club`
- "Ya tengo mi link" → input de token → redirect a `/coach/[token]`

### Scanner de Acreditación
`/tournament/[id]/accredit` — página pública (sin NextAuth):
1. Pide PIN del torneo (`Tournament.accreditationPin`)
2. Activa cámara (html5-qrcode) o entrada manual
3. `GET /api/public/tournament-accredit/[qrCode]` → info del atleta
4. `PUT /api/public/tournament-accredit/[qrCode]` → confirmar acceso (requiere PIN + tournamentId)
- ✅ Verde: atleta aprobado y pagado
- ⚠️ Amarillo: warnings (ya acreditado, pago pendiente)
- ❌ Rojo: no encontrado o no autorizado

### Overlay OBS — estructura visual
```
1920×1080 canvas, background: transparent

[TOP-LEFT]  ● TATAMI A          [TOP-RIGHT] ● EN VIVO (si live)
            Bracket · Género · R1 #1

[BOTTOM]
┌─────────────────────────┐ ┌──────────┐ ┌──────────────────────────┐
│AO  [Avatar] NOMBRE  [5] │ │  1:45    │ │ [5]  NOMBRE  [Avatar] AKA│
│         Dojo · 🇻🇪 · 65kg│ │    VS    │ │  65kg · 🇨🇴 · Dojo       │
└── fondo azul ───────────┘ └──────────┘ └── fondo rojo ────────────┘
```
- Timer: blanco (>30s) → amarillo (≤30s) → rojo parpadeante (0:00)
- Ganador: borde dorado en la tarjeta ganadora
- Si atleta tiene `rankingSeed` validado: muestra `★ #N` junto al nombre

### Display TV — Máquina de estados (v2.0)
`TournamentTatami.matchDisplayState` controla la pantalla en sala y el overlay OBS:

| Estado | Pantalla TV | Overlay OBS |
|---|---|---|
| `idle` | Logo torneo + reloj + próxima categoría | Solo nombre tatami |
| `active` | Combatientes + puntaje + timer + ronda | Tarjetas AO/AKA completas + timer |
| `winner` | Celebración ganador (foto grande, confetti, razón victoria) | Foto ganador + borde dorado |
| `next_preview` | "PRÓXIMO COMBATE" + dos atletas side-by-side | Mini-preview próximos combatientes |

- Cambio via `PUT /api/tournaments/[id]/tatami/[tatamiId]/display-state { state, winnerId, winnerReason }`
- `matchWonAt`: cuando se setea, el display inicia cuenta regresiva 10s automática → `next_preview`
- `getWinnerReasonText(reason)` en `src/lib/tournament-categories.ts` convierte código a texto legible

### APIs real-time de tatami
```
GET/PUT /api/tournaments/[id]/tatami/[tatamiId]/active-match    → match activo en el tatami
GET/PUT /api/tournaments/[id]/tatami/[tatamiId]/timer           → control del timer del match
GET/PUT /api/tournaments/[id]/tatami/[tatamiId]/stream          → config stream por tatami
PUT     /api/tournaments/[id]/tatami/[tatamiId]/display-state   → estado pantalla TV (v2.0)
        body: { state, winnerId?, winnerReason? }
        states: "idle"|"active"|"winner"|"next_preview"
```

### APIs de puntuación de jueces
```
GET/POST/PUT /api/tournaments/[id]/matches/[matchId]/judge-scores
```
- Cada juez tiene su propia fila `TournamentJudgeScore` (unique matchId+judgeId)
- Puntuación Kumite: ippon (3pts) / wazaari (2pts) / yuko (1pt) + penalizaciones
- Puntuación Kata: nota decimal (ej. 8.5) por juez, se promedia

### APIs públicas (sin auth) — seguridad aplicada
```
GET /api/public/judge-app/[tournamentId]       → info para la app de juez
                                                  Solo responde si torneo está en ready/active/completed/confirmed
GET /api/public/tatami-display/[tatamiId]      → datos del display de tatami
                                                  Siempre devuelve info básica del tatami (para setup/pruebas)
                                                  Solo devuelve datos de combate/participantes si torneo está en ready/active/completed/confirmed
                                                  Nunca devuelve cédula del alumno
POST /api/public/match-senshu                  → marcar senshu (desempate)
                                                  Requiere judgeId válido del mismo torneo (validado en BD)
GET /api/public/tournaments/[slug]/scoreboard  → scoreboard público del torneo
```

---

## Analytics y Trazabilidad

### Google Analytics 4
- ID de medición: `G-KTK190P7T3`
- Instalado en `src/app/layout.tsx` con `<Script strategy="afterInteractive">`
- Dominio `googletagmanager.com` agregado al CSP en `next.config.js` (script-src y connect-src)
- Rastrea todas las páginas de `dojomasteronline.com` automáticamente

### Trazabilidad nativa (sin GA)
- **Visitas a página pública**: `PUBLIC_PAGE_VISITED` en audit_log con IP, país, ciudad, user-agent
- **Solicitudes de clase gratis**: `FREE_TRIAL_REQUESTED` + email inmediato al admin del dojo
- **Registros de nuevos dojos**: `DOJO_SELF_REGISTERED` con todos los datos del prospecto
- Ver todo en `/dashboard/audit-log` (sysadmin) filtrando por acción

### Formulario de registro (`/register`)
- Nuevo campo: **"¿Cuántos años llevas enseñando karate?"** (select: <1, 1-3, 4-7, 8-15, >15)
- Nuevo checkbox: **confirmación de mayoría de edad + aceptación de Términos** (requerido para enviar)
- Email al founder incluye: nombre, dojo, email, WhatsApp, país, alumnos, **años enseñando**
- Botón "WhatsApp al Sensei" y "Responder por email" directamente en el email de notificación

---

## Sistema de Ayuda (HelpButton)

### Componentes
- `src/lib/help-content.ts` — contenido por ruta (título, emoji, descripción, pasos, consejos)
- `src/components/ui/HelpButton.tsx` — botón `?` flotante (fixed bottom-right), solo aparece si hay contenido para la ruta actual
- `src/components/ui/HelpDrawer.tsx` — panel deslizante desde la derecha (`animate-slide-in-right`)

### Integración
- `HelpButton` agregado UNA vez en `dashboard/layout.tsx` — cubre todas las rutas automáticamente
- Usa `usePathname()` → `getHelpContent(pathname)` para determinar qué mostrar
- Cierra con Esc, clic en backdrop, o botón "Cerrar ayuda"
- Texto siempre en `text-dojo-sidebar-text` (legible en todos los temas)

### Agregar ayuda a nueva ruta
```ts
// src/lib/help-content.ts
"/dashboard/nueva-ruta": {
  title: "Nombre del módulo",
  emoji: "🎯",
  description: "Qué hace este módulo.",
  steps: ["Paso 1...", "Paso 2..."],
  tips: ["Consejo opcional..."],
}
```

---

## Categorías WKF — `src/lib/tournament-categories.ts`

### Grupos de edad (`AGE_GROUPS`)
```
mini_4_5 (4-5 años)  · mini_6_7 (6-7)  · infantil_a (8-9)  · infantil_b (10-11)
pre_cadete (11-12)   · cadete (13-15)   · junior (16-17)    · sub21 (18-20)
senior (18+)         · master35 (35+)   · master45 (45+)    · open (cualquier edad)
```
- `wkfOfficial: false` para mini_4_5, mini_6_7, infantil_a, infantil_b, open
- `mini_4_5`: solo kata — kumite no permitido
- `mini_6_7` a `infantil_b`: sin división por peso (siempre "open")
- En UI: badge `⚠️ Categoría no WKF` para categorías no oficiales

### Categorías de peso por edad/género (`WEIGHT_CATEGORIES`)
- Senior/Sub21/Junior tienen pesos WKF estándar (-60kg a +84kg para M, -50kg a +68kg para F)
- Cadete/Pre-cadete tienen pesos reducidos
- Infantil/Mini: siempre "open"

### Funciones helpers
| Función | Descripción |
|---|---|
| `buildCategoryLabel(type, gender, ageGroup, weightCategory, isTeamKata)` | Genera el nombre automático: "Kumite Cadete -63kg Masculino" |
| `calculateAgeGroup(birthDate, tournamentDate)` | Calcula grupo de edad de un atleta para la fecha del torneo |
| `getCompatibleCategories(brackets, athlete)` | Filtra brackets compatibles con el atleta (género, edad, peso) |
| `getRoundLabel(round, totalParticipants)` | "FINAL" / "SEMIFINAL" / "CUARTOS DE FINAL" / "RONDA N" |
| `getWinnerReasonText(reason, locale)` | "Victoria por IPPON" / "Win by SENSHU" etc. |

### Categorías por cinta (`BELT_CATEGORIES`)
- `principiantes`: blanca → naranja
- `intermedios`: verde → azul
- `avanzados`: morada → café-3-rayas
- `elite`: negra y dans

---

## Torneos Abiertos (v2.0) — Flujo

### Configuración (`Tournament.tournamentType`)
- `internal`: solo alumnos del dojo (flujo actual)
- `open`: clubs externos se inscriben con un link de coach
- `federated`: igual que open + validación de federación

### Flujo de inscripción externa
```
Página pública /public/tournament/[slug]
  └── Botón "Inscribir mi Club" → modal
        └── POST /api/public/tournaments/[slug]/register-club
              → crea ExternalClub con accessToken JWT
              → envía email al coach con URL /coach/[token]

Coach en /coach/[token]:
  → Agrega atletas (calculateAgeGroup automático)
  → Selecciona categorías compatibles (getCompatibleCategories)
  → Marca atletas ranking (isRanking + rankingNote)
  → Sube comprobante de pago (Cloudinary)

Admin en dashboard tab "Inscripciones":
  → Aprueba/rechaza clubs y atletas
  → Valida rankings → asigna rankingSeed
  → Cuando club.status=approved + paymentStatus=paid:
      → Trigger automático: genera QRs + envía emails de credencial
  → Botón "Generar brackets desde inscripciones aprobadas"
```

### Portal del Coach — `src/lib/coach-token.ts`
- JWT firmado con `NEXTAUTH_SECRET`, issuer `"dojomanager-coach"`, expiración 30 días
- `CoachTokenPayload`: `{ clubId, tournamentId, dojoId, coachEmail, type: "coach_access" }`
- `dojoId` SIEMPRE presente en el token — valida en cada request que el club pertenece al dojo correcto
- **Función `requireCoachToken(token)`**: valida el JWT y retorna el payload o error
- Las rutas del coach tienen headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`

### APIs del portal del coach (públicas, requieren token JWT)
```
GET  /api/public/tournament-club/[token]              → datos del club + atletas + tournament info
POST /api/public/tournament-club/[token]/athletes     → agregar atleta + categorías
PUT  /api/public/tournament-club/[token]/athletes/[id]→ editar atleta
DELETE /api/public/tournament-club/[token]/athletes/[id] → retirar atleta
PUT  /api/public/tournament-club/[token]/payment      → subir comprobante + paymentRef
POST /api/public/tournaments/[slug]/register-club     → registro inicial (rate limit: 5 req/min)
```

### APIs del organizador (autenticadas)
```
GET  /api/tournaments/[id]/external-clubs              → lista clubs + atletas del torneo
PUT  /api/tournaments/[id]/external-clubs/[clubId]     → aprobar/rechazar/actualizar estado
POST /api/tournaments/[id]/external-clubs/[clubId]/send-credentials → genera QRs + envía emails
```

---

## Sistema de Acreditación QR (v2.1)

### Regla de negocio crítica
```
QR solo se genera cuando:
  ExternalAthlete: club.status === "approved" AND club.paymentStatus === "paid"|"waived"
  TournamentParticipant (interno): tournament.status === "ready"|"active" AND admin confirma lista
```

### Librería `src/lib/tournament-qr.ts`
- `generateAthleteQRCode(tournamentSlug)` → código corto `"COPA25-A3K9MX"` (nunca datos personales en QR)
- `generateQRImageDataURL(code)` → PNG base64 para embeber en email (usa `qrcode` npm package)
- `buildCredentialEmailHTML(data)` → HTML del email de credencial con QR, nombre, categorías, instrucciones

### Scanner de entrada — `/tournament/[id]/accredit`
- Página pública (sin NextAuth) — abre en tablet del voluntario
- Pide PIN del torneo (`Tournament.accreditationPin`) antes de activar cámara
- Muestra: ✅ verde (permitido) / ⚠️ amarillo (warnings) / ❌ rojo (no autorizado)
- NO lista atletas — solo valida uno a la vez
- `PUT /api/public/tournament-accredit/[qrCode]` requiere `{ pin, tournamentId }` en el body

### APIs de acreditación
```
GET /api/public/tournament-accredit/[qrCode]   → valida QR, devuelve info del atleta (sin documentId/email)
PUT /api/public/tournament-accredit/[qrCode]   → marca accreditedAt — requiere PIN del torneo
    Rate limit: 60 req/min por IP
```

---

## Sistema de Ranking y Seeding (v2.1) — `src/lib/tournament-seeding.ts`

- `distributeParticipantsWithSeeds(participants, bracketSize)` → coloca seeds en posiciones WKF fijas
- Seed 1 y 2: cuartos opuestos → se enfrentan en la FINAL
- Seed 3 y 4: cuartos opuestos → se enfrentan en SEMIFINAL
- Bracket size soportados: 8, 16, 32

### Flujo del organizador para seeds
1. Coach marca `isRanking = true` + nota en portal
2. Admin valida → `rankingValidated = true` + asigna `rankingSeed` (1-4)
3. Al generar bracket: `distributeParticipantsWithSeeds()` respeta las posiciones
4. En overlay OBS y pantalla TV: atletas con seed validado muestran `★ #N`

---

## TopBar Dinámico

- `ROUTE_LABELS` en `TopBar.tsx` mapea rutas conocidas a título + breadcrumb
- Rutas dinámicas (`/dashboard/students/[id]/edit`) detectadas por prefijo y sufijo
- Muestra: `[breadcrumb padre →] Título de la página · fecha de hoy`
- Para agregar una ruta nueva: añadir entrada en `ROUTE_LABELS` en `src/components/layout/TopBar.tsx`

---

## Sistema Sysadmin Multi-Dojo

El sysadmin puede "entrar" en cualquier dojo para operar dentro de él como admin.

### Flujo
1. En `/dashboard/dojos`, botón "Entrar" en cada dojo → `POST /api/sysadmin/set-dojo { dojoId }`
2. API setea cookies de sesión: `sx-dojo` (dojoId) y `sx-dojo-name` (nombre)
3. Todas las APIs usan `getEffectiveDojoId()` de `src/lib/sysadmin-context.ts`:
   - Si `role === "sysadmin"` → lee cookie `sx-dojo`
   - Si `role !== "sysadmin"` → usa `session.user.dojoId`
4. Salir del dojo: `POST /api/sysadmin/exit-dojo` (borra cookies)

### Reglas
- Sin cookie `sx-dojo`, sysadmin recibe 403 con mensaje `NO_DOJO_CONTEXT_ERROR` en rutas de dojo
- Las notificaciones del sysadmin sin contexto muestran solo alertas de seguridad global
- Las APIs globales (dojos, audit-logs) no usan `getEffectiveDojoId()`

---

## Módulo Página Pública del Dojo (`/dojo/[slug]`)

### Flujo admin
1. Admin edita en `/dashboard/settings/public-page`
2. Guarda via `PUT /api/dojo-page` (upsert en `DojoPage`)
3. Publica con el toggle `published` → visible en `/dojo/[slug]`
4. Preview antes de publicar: botón "Vista previa" → abre `/dojo/[slug]?preview=1`

### Estructura de la página pública
- **Nav** — logo (izquierda) · links (centro) · botones CTA (derecha)
- **Hero** — `heroImage` Cloudinary + `heroTitle` + `heroSubtitle` + CTA formulario prueba gratis
- **About** — `aboutText` + `aboutImage`
- **Estadísticas** — `stats[]` configurable
- **Sensei** — `sensei.name/rank/experience/bio/photo`
- **Galería** — `galleryImages[]` URLs Cloudinary — renderizada como **carrusel horizontal** con botones ← → y swipe en móvil (`GalleryCarousel` en `DojoPublicPage.tsx`). Fotos de 220×165px con scroll-snap.
- **Testimonios** — `testimonials[]`
- **Tienda** — visible solo si `showStore=true`; productos via `GET /api/public/store?slug=`
- **Horarios** — visible si `showSchedules=true`
- **Formulario prueba gratis** — visible si `showFreeTrial=true`; `POST /api/public/free-trial`
- **Organizaciones** — logos de federaciones (DojoOrganization) en sección "Avalado por"
- **Ubicación** — `address`

### Metadata SEO
- `dojo.slogan` se usa en la descripción Open Graph
- `dojo.logo` como imagen OG

### Login exclusivo por dojo (`/dojo/[slug]/login`)
- Muestra el branding del dojo (logo, nombre, `loginBgImage`)
- Redirige a `/dashboard` al autenticarse

---

## CRM de Prospectos (`/dashboard/leads`)

- Leads generados desde el formulario de prueba gratis de la página pública del dojo
- Flujo de estado: `pending → contacted → scheduled → enrolled | cancelled`
- Al cargar la página (`GET /api/leads`), los leads se marcan como `read: true` automáticamente
- Admin puede asignar clase (`scheduleId`), agregar notas, cambiar estado
- `PUT /api/leads/[id]` — actualizar estado/notas/scheduleId
- `DELETE /api/leads/[id]` — eliminar prospecto

---

## Tienda del Dojo (`/dashboard/store`)

- Catálogo de productos gestionado por admin
- No hay carrito — el cliente contacta por WhatsApp
- Productos: nombre, descripción, precio, moneda, imagen (Cloudinary), tallas (JSON array), activo/inactivo, order
- Vista pública en `/dojo/[slug]` solo si `DojoPage.showStore = true`
- `GET /api/public/store?slug=` — productos activos sin auth

---

## Módulo de Torneos (`/dashboard/tournaments`)

### Torneo Pro (feature-gated por `Dojo.tournamentPro`)
- Sidebar muestra el ítem; al hacer clic se abre popup "Torneo Pro" (lock) si el dojo no tiene acceso
- `sysadmin` siempre tiene acceso completo
- Admin ve el popup y puede solicitar acceso

### Flujo completo (torneo interno)
1. Admin crea torneo en `/dashboard/tournaments-pro/new`
2. Cambia estado a `ready` o `active` desde el selector en el header del torneo
3. Crea brackets usando categorías WKF (`buildCategoryLabel()` genera nombre automático)
4. Agrega participantes → genera bracket (con seeding si hay atletas ranking)
5. Asigna jueces a tatamis → `POST /api/tournaments/[id]/judges`
6. Tab "En Vivo" → sección tatami → dropdown **"★ COMBATE ACTIVO EN PANTALLA"** → selecciona match
7. Combate en vivo: árbitro activa match + controla display-state → jueces puntúan
8. Resultados van a `TournamentJudgeScore` → se consolidan en `TournamentMatch`
9. Vista pública en `/public/tournament/[slug]` — inscripciones federativas

### Flujo adicional (torneo abierto — `tournamentType: "open"`)
1. Admin activa `tournamentType = "open"` + configura cuotas y fecha de cierre
2. Coaches externos se registran en `/public/tournament/[slug]` → reciben link `/coach/[token]`
3. Coach agrega atletas en su portal → sistema calcula grupo de edad automáticamente
4. Coach marca atletas ranking con nota
5. Admin revisa en tab "Inscripciones" → aprueba clubs/atletas → valida rankings → asigna seeds
6. Admin configura PIN de acreditación (`accreditationPin`) en settings del torneo
7. Al aprobar + marcar pagado: trigger automático genera QRs y envía emails de credencial
8. Día del torneo: voluntario usa `/tournament/[id]/accredit` con PIN para escanear QRs en entrada
10. Stream YouTube + Overlay OBS: abrir `/tournament/[id]/overlay` (logueado) → copiar URL del tatami → pegar en OBS (Browser Source 1920×1080)

### Kata bracket
- Muestra lista ordenada de participantes (no árbol)
- Generación aleatoria del orden con avatares
- Importación desde bracket Kumite del mismo torneo

---

## Sistema de Auditoría Profunda

### `src/lib/audit.ts` — módulo central
- **`AUDIT_MODULE`**: constantes de módulos (`AUTH`, `STUDENTS`, `PAYMENTS`, `BELTS`, `ATTENDANCE`, `USERS`, `SETTINGS`, `SYSADMIN`, `TOURNAMENTS`, `PORTAL`)
- **`buildAuditCtx(session, req, opts?)`**: extrae automáticamente `userId`, `userName`, `userEmail`, `dojoId`, `method`, `ip`, `userAgent`, `country`, `city`, `region`, `sessionId`, `isSysadminProxy`, `duration` desde la sesión y el request de Next.js
- **`logAudit(params)`**: inserta en `audit_logs` con SHA-256 (`hash`) para detectar tampering. NUNCA lanza error.
- **GeoIP sin costo**: headers `x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-region` (Vercel) y `cf-ipcountry` (Cloudflare)
- **sessionId**: UUID generado al login, incluido en el JWT, correlaciona todos los eventos de la misma sesión

### Eventos auditados
| Acción | Módulo | Cuándo |
|--------|--------|--------|
| `LOGIN_SUCCESS` / `LOGIN_FAILED` | AUTH | Cada intento de login |
| `STUDENT_CREATED` / `UPDATED` / `ACTIVATED` / `DEACTIVATED` / `DELETED` | STUDENTS | CRUD de alumnos |
| `STUDENTS_IMPORTED` | STUDENTS | Importación masiva Excel |
| `PAYMENT_CREATED` / `UPDATED` / `MARKED_PAID` | PAYMENTS | Operaciones de pago |
| `BELT_ADDED` / `BELT_RANKING_ADDED` / `BELT_UPDATED` / `BELT_DELETED` | BELTS | Historial de cintas |
| `ATTENDANCE_ENTRY` / `ATTENDANCE_EXIT` | ATTENDANCE | Scanner QR |
| `USER_CREATED` / `UPDATED` / `DELETED` / `ACTIVATED` / `DEACTIVATED` | USERS | Gestión de usuarios |
| `PORTAL_ACCESS_GRANTED` / `REVOKED` | PORTAL | Acceso al portal del alumno |
| `DOJO_SETTINGS_UPDATED` | SETTINGS | Configuración del dojo |
| `EMAIL_SETTINGS_UPDATED` | SETTINGS | Config SMTP |
| `SYSADMIN_ENTER_DOJO` / `EXIT_DOJO` | SYSADMIN | Contexto sysadmin |
| `DOJO_CREATED` / `DELETED` / `SELF_REGISTERED` | SYSADMIN | Gestión de dojos |
| `REPORT_EXPORTED` | STUDENTS | Descarga de reportes |
| `FREE_TRIAL_REQUESTED` | PORTAL | Solicitud de clase gratis desde página pública |
| `PUBLIC_PAGE_VISITED` | PORTAL | Visita a página pública del dojo |
| `SECURITY_ANOMALY` | AUTH | Acceso cross-dojo detectado |

### Integridad (SHA-256)
Cada log incluye `hash = SHA256({ action, module, userId, dojoId, resourceType, resourceId, ip, statusCode, sessionId, timestamp })`. Para verificar tampering: recomputar hash con los mismos campos y comparar.

### Patrón de uso en routes
```typescript
const t0  = Date.now();
const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
await logAudit({
  ...ctx,
  action:       "STUDENT_CREATED",
  module:       AUDIT_MODULE.STUDENTS,
  resourceType: "Student",
  resourceId:   student.id,
  statusCode:   201,
  details:      JSON.stringify({ before: null, after: { fullName, active: true } }),
});
```

---

## Sistema de Notificaciones (`GET /api/notifications`)

Devuelve `{ total, leads, latePayments, attendance, securityAlerts }`:

| Campo | Descripción |
|---|---|
| `leads.count` | `FreeTrialRequest` con `read=false` y `status="pending"` — prospectos nuevos |
| `latePayments.count` | Pagos con `status="late"` |
| `attendance.alert` | Alumnos sin asistencia 3-13 días (`ALERTA`) |
| `attendance.risk` | Alumnos sin asistencia ≥14 días (`RIESGO`) |
| `securityAlerts` | Solo sysadmin — `SECURITY_ANOMALY` en audit_logs (últimos 7 días) |

- Mostrado en el **TopBar** (icono `Bell`) con badge de count total
- Sysadmin sin contexto de dojo: solo ve alertas de seguridad y logins de sysadmin

---

## Acceso Portal Alumno (`POST /api/students/[id]/access`)

- Crea o restaura acceso al portal (`/portal`) para un alumno
- Usa el email de madre o padre del alumno
- Genera contraseña temporal aleatoria + `mustChangePassword: true`
- Envía correo de bienvenida (`sendStudentWelcome`) con credenciales
- `DELETE /api/students/[id]/access` — desactiva el acceso (no elimina el usuario)
- Devuelve `{ ok, email, tempPassword, emailSent, emailError }`

---

## APIs

```
POST /api/upload                      → Sube imagen o video a Cloudinary. FormData: file + type(image|video).
                                        Solo admin/sysadmin. Devuelve { url, publicId }.
GET/POST /api/roles                   → Lista roles del dojo (system + custom) con sus permisos. POST crea rol personalizado.
PUT/DELETE /api/roles/[id]            → Actualiza permisos / elimina rol personalizado (falla si hay usuarios con ese rol)
POST /api/roles/system                → Crea o actualiza override de rol de sistema (admin/user) con permisos custom
GET /api/roles/current                → Devuelve { permissions: NavKey[] } del usuario actual. Usado por AppContext.
GET/POST /api/users                   → Lista usuarios. POST crea usuario con photo opcional.
PUT/DELETE /api/users/[id]            → Edita usuario (name,email,role,photo,active,password). DELETE falla si es el último sysadmin.
GET/POST /api/belt-videos             → CRUD videos por cinta. GET acepta ?beltColor=
PUT/DELETE /api/belt-videos/[id]      → Actualiza/elimina video (también borra de Cloudinary en DELETE)
GET /api/portal/belt-videos           → Solo para role=student. Devuelve { videos, earnedBelts }
                                        filtrado por cintas obtenidas en BeltHistory del alumno
GET /api/portal/events?status=        → Solo role=student. Eventos del dojo del alumno (active|past)
GET/POST /api/events                  → admin: lista (active|past) / crear evento
PUT/DELETE /api/events/[id]           → admin: editar / eliminar evento
PUT /api/dojo/theme                   → admin/sysadmin: guardar tema { theme: ThemeId }
GET/PUT /api/dojo-page                → Config página pública del dojo (upsert). Solo admin/sysadmin.
GET/POST /api/dojo-organizations      → Organizaciones del dojo. Solo admin/sysadmin.
PUT/DELETE /api/dojo-organizations/[id] → Editar nombre/logo/order / eliminar organización
GET /api/public/dojo-page?slug=       → Página pública sin auth (solo si published=true). Registra `PUBLIC_PAGE_VISITED` en audit log con IP y GeoIP.
GET/POST /api/store-products          → Productos de la tienda del dojo
PUT/DELETE /api/store-products/[id]   → Editar/eliminar producto
GET /api/public/store?slug=           → Productos activos sin auth
GET /api/leads                        → CRM prospectos (FreeTrialRequest). Marca read=true al cargar.
PUT/DELETE /api/leads/[id]            → Actualizar estado/notas / eliminar prospecto
POST /api/public/free-trial           → Crear solicitud de prueba gratis (sin auth). Registra IP/país/ciudad en audit log.
                                        Envía email inmediato a los admins del dojo. Incluye en notificaciones del TopBar.
POST /api/public/register             → Registro de nuevo dojo desde landing page (sin auth).
                                        Campos: senseiName, dojoName, country, email, phone, studentCount, yearsTeaching.
                                        Envía email de bienvenida al sensei + notificación al founder con todos los datos.
                                        Registra `DOJO_SELF_REGISTERED` en audit log con IP y GeoIP.
POST /api/sysadmin/set-dojo           → Sysadmin entra a un dojo — setea cookies sx-dojo / sx-dojo-name
POST /api/sysadmin/exit-dojo          → Sysadmin sale del dojo — borra cookies
GET /api/notifications                → Alertas activas: pagos atrasados + alumnos en riesgo + seg. sysadmin
GET /api/audit-logs                   → Log de auditoría. Solo sysadmin.
POST /api/students/[id]/access        → Crear/restaurar acceso portal alumno. Envía correo bienvenida.
DELETE /api/students/[id]/access      → Desactivar acceso portal alumno.
GET /api/attendance/weekly            → Asistencia agrupada por semana (para el dashboard)
GET/POST /api/tournaments             → Lista torneos del dojo / crear torneo
GET/PUT/DELETE /api/tournaments/[id]  → Detalle / editar / eliminar torneo
PUT /api/tournaments/[id]/status      → Cambiar estado del torneo
POST /api/tournaments/[id]/confirm    → Confirmar torneo (bloquea brackets)
POST /api/tournaments/[id]/archive    → Archivar torneo
GET/POST /api/tournaments/[id]/brackets            → Brackets del torneo
PUT/DELETE /api/tournaments/[id]/brackets/[bId]    → Editar/eliminar bracket
POST /api/tournaments/[id]/brackets/[bId]/bracket  → Generar bracket automático
POST /api/tournaments/[id]/brackets/[bId]/import-from → Importar participantes de otro bracket
PUT /api/tournaments/[id]/brackets/[bId]/kata-order   → Reordenar kata bracket
GET/POST /api/tournaments/[id]/brackets/[bId]/participants → Participantes del bracket
GET/PUT /api/tournaments/[id]/brackets/[bId]/schedule → Cronograma del bracket (slots)
POST /api/tournaments/[id]/brackets/[bId]/reopen   → Reabrir bracket confirmado (sysadmin)
GET/POST /api/tournaments/[id]/participants        → Participantes del torneo
GET/PUT /api/tournaments/[id]/matches/[mId]        → Resultado de un match
GET/POST/PUT /api/tournaments/[id]/matches/[mId]/judge-scores → Puntuaciones por juez
GET/POST /api/tournaments/[id]/judges              → Jueces del torneo
PUT/DELETE /api/tournaments/[id]/judges/[jId]
GET/POST /api/tournaments/[id]/referees            → Árbitros del torneo
GET/POST /api/tournaments/[id]/tatami              → Tatamis del torneo
PUT/DELETE /api/tournaments/[id]/tatami/[tId]
GET/PUT /api/tournaments/[id]/tatami/[tId]/active-match  → Match activo en el tatami (real-time)
GET/PUT /api/tournaments/[id]/tatami/[tId]/timer         → Timer del match (start/stop/reset)
GET/PUT /api/tournaments/[id]/tatami/[tId]/stream        → Config stream por tatami
PUT     /api/tournaments/[id]/tatami/[tId]/display-state → Estado TV: idle|active|winner|next_preview
GET/POST/PUT /api/tournaments/[id]/matches/[mId]/video-review → Video review (POST=solicitar, PUT=decidir)
GET /api/tournaments/[id]/external-clubs                 → Lista clubs externos del torneo (admin)
PUT /api/tournaments/[id]/external-clubs/[clubId]        → Aprobar/rechazar club + notificación email
POST /api/tournaments/[id]/external-clubs/[clubId]/send-credentials → Genera QRs + envía emails
GET/PUT /api/tournaments/[id]/stream               → Config YouTube stream general
GET/POST /api/tournaments/[id]/schedule            → Programa global del torneo
PUT /api/tournaments/[id]/schedule/[slotId]
GET/POST /api/tournaments/[id]/registrations       → Inscripciones federativas
PUT/DELETE /api/tournaments/[id]/registrations/[rId]
GET /api/tournaments/[id]/referees                 → Árbitros del torneo
GET /api/public/tournaments/[slug]                         → Info pública del torneo (incluye tournamentType, entryFeePerCategory)
GET /api/public/tournaments/[slug]/stream                  → Info de stream pública
GET /api/public/tournaments/[slug]/scoreboard              → Scoreboard público del torneo
POST /api/public/tournaments/[slug]/register-club          → Registro de club externo (rate 5/min)
GET  /api/public/tournament-club/[token]                   → Portal coach: datos del club (JWT)
POST /api/public/tournament-club/[token]/athletes          → Coach agrega atleta + categorías
PUT  /api/public/tournament-club/[token]/athletes          → Coach edita atleta
DELETE /api/public/tournament-club/[token]/athletes        → Coach retira atleta (status=withdrawn)
PUT  /api/public/tournament-club/[token]/payment           → Coach sube comprobante (URL Cloudinary)
GET  /api/public/tournament-accredit/[qrCode]              → Valida QR en entrada (sin auth, rate 60/min)
PUT  /api/public/tournament-accredit/[qrCode]              → Marca acreditado — requiere { pin, tournamentId }
POST /api/public/tournaments/[slug]/register       → Inscripción federativa pública (sin auth)
GET /api/public/judge-app/[tournamentId]           → Info para app de juez (sin auth)
GET /api/public/tatami-display/[tatamiId]          → Datos del display de tatami (sin auth)
POST /api/public/match-senshu                      → Marcar senshu/desempate (sin auth)
PUT /api/tournaments/[id]/tatami/[tId]/display-state → Estado pantalla TV (idle|active|winner|next_preview)
GET/POST /api/tournaments/[id]/matches/[mId]/video-review → Video review (POST=solicitar+pausa timer, PUT=decidir)
GET/POST /api/tournaments/[id]/matches/[mId]/hantei        → Hantei: GET=estado, POST=llamar votación (admin)
POST /api/tournaments/[id]/matches/[mId]/hantei/vote       → Juez emite voto ao/aka (sin NextAuth, por judgeId)
POST /api/tournaments/[id]/matches/[mId]/hantei/decide     → Cerrar votación + registrar ganador (admin)
GET /api/tournaments/[id]/external-clubs           → Lista clubs externos del torneo (admin)
PUT /api/tournaments/[id]/external-clubs/[clubId]  → Aprobar/rechazar/actualizar club
POST /api/tournaments/[id]/external-clubs/[clubId]/send-credentials → Genera QRs + envía emails credencial
GET  /api/public/tournament-club/[token]           → Portal coach: datos del club (JWT requerido)
POST /api/public/tournament-club/[token]/athletes  → Coach agrega atleta + categorías
PUT  /api/public/tournament-club/[token]/athletes/[id] → Coach edita atleta
PUT  /api/public/tournament-club/[token]/payment   → Coach sube comprobante de pago
POST /api/public/tournaments/[slug]/register-club  → Registro inicial de club (sin auth, rate limit 5/min)
GET  /api/public/tournament-accredit/[qrCode]      → Valida QR en entrada (sin auth, rate limit 60/min)
PUT  /api/public/tournament-accredit/[qrCode]      → Marca acreditado — requiere { pin, tournamentId }
GET  /api/portal/live-tatamis                      → Tatamis en vivo del dojo del alumno (rol student)
POST /api/seed
GET/PUT  /api/dojo                    → Config del dojo. GET excluye logo/loginBgImage por defecto.
                                        Usar ?logo=1 para incluirlos. PUT invalida caché dojo.
GET/POST /api/dojos                   → Gestión dojos (sysadmin)
PUT/DELETE /api/dojos/[id]            → DELETE elimina dojo + TODA su data en cascada (sysadmin). Irreversible.
GET /api/public/dojo/[slug]           → Branding público (sin auth)
GET /api/public/login-bg?slug=        → Imagen de fondo del login (sin auth)
GET/POST /api/students                → Alumnos filtrados (dojoId). GET: NO incluye photo
GET/PUT/DELETE /api/students/[id]     → Perfil completo. payments: take 24, beltHistory: take 50
POST /api/payments                    → Crear pago
PUT  /api/payments                    → Actualizar pago
PATCH /api/payments                   → Envío masivo recordatorios (usa toleranceDays del dojo)
POST /api/payments/remind             → Recordatorio individual { paymentId }
POST /api/payments/generate           → Genera mensualidades del mes (createMany, sin N+1)
POST /api/payments/receipt            → Envía recibo de pago { paymentId }
GET/POST /api/belt-history
PUT/DELETE /api/belt-history/[id]
GET/POST /api/kata-competitions       → ?studentId= para filtrar
PUT/DELETE /api/kata-competitions/[id]
GET/POST /api/katas                   → Sin ?active: todas (gestión). Con ?active=1: caché activas
PUT/DELETE /api/katas/[id]            → Invalida caché katas del dojo
GET/POST /api/users
GET /api/reports?type=belt|age|payments|ranking
GET/POST /api/schedules
GET /api/schedules/students           → Alumnos con horario asignado (devuelve fullName)
PUT/DELETE /api/schedules/[id]
GET/POST /api/attendance              → GET: auth requerida. POST: **requiere sesión** (corregido — antes era público).
                                        Filtra student por { id: studentId, dojoId } — no puede marcarse alumno de otro dojo.
PUT/DELETE /api/attendance/[id]
GET /api/attendance/weekly            → Asistencia semanal agrupada (para gráfico dashboard)
GET /api/scan?id=studentId&scheduleId → **Requiere sesión** (corregido). Filtra por dojoId de la sesión.
                                        Alumno de otro dojo → 404. Soporta studentCode numérico.
                                        Si NOT_ASSIGNED: { code:"NOT_ASSIGNED", student }
PUT /api/auth/change-password         → Limpia mustChangePassword → signOut para renovar JWT
POST /api/auth/[...nextauth]
GET/PUT /api/admin/email-settings     → SMTP config (sysadmin). PUT cifra la contraseña.
POST /api/admin/email-settings/test   → Envía correo de prueba (sysadmin)
```

---

## Seguridad — reglas implementadas

### Rate limiting (middleware.ts)
| Endpoint | Límite | Ventana |
|---|---|---|
| `POST /api/auth/callback/credentials` | 10 req | 15 min (anti brute-force) |
| `GET /api/scan` | 60 req | 1 min |
| `POST /api/attendance` | 120 req | 1 min |
| `POST /api/public/free-trial` | 5 req | 1 min |
| `GET/POST /api/public/tournaments/*` | — | en middleware |

Responde `429 Too Many Requests` con `Retry-After`.

### Aislamiento multi-tenant en scanner (CRÍTICO)
- `GET /api/scan` **requiere sesión** — filtra alumno con `where: { id, dojoId }`. Un alumno de otro dojo retorna 404.
- `POST /api/attendance` **requiere sesión** — filtra con `where: { id: studentId, dojoId }`. No puede marcarse asistencia de otro dojo.
- Ambas rutas antes eran públicas — fueron corregidas para cumplir el aislamiento multi-tenant.

### Seguridad HTTP (next.config.js)
- `X-Frame-Options: DENY` — anti-clickjacking (rutas globales)
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=63072000`
- **`/coach/:path*`**: `Cache-Control: no-store` + `X-Robots-Tag: noindex, nofollow` — links privados no indexados
- **`/tournament/:path*`**: `X-Robots-Tag: noindex, nofollow` — overlays y scanner no indexados
- `frame-src: https://www.youtube.com` — iframes de YouTube permitidos (overlays, portal live, página pública torneo)
- `Content-Security-Policy` con directivas específicas
- `Permissions-Policy: camera=(self)` — solo para scanner QR

### Cifrado y aleatoriedad segura
- Contraseña SMTP: AES-256-CBC con IV aleatorio — `src/lib/crypto.ts`
- Clave en `ENCRYPTION_KEY` (32 bytes base64 en `.env.local`)
- Nunca retornar la contraseña al cliente (se devuelve `"••••••••"`)
- Al re-guardar sin cambiar contraseña, enviar `"••••••••"` → API detecta y preserva el valor cifrado
- **Contraseñas temporales**: usar `randomInt` de `crypto` con Fisher-Yates — NUNCA `Math.random()`
- **QR de acreditación**: usar `randomBytes(4).toString("hex")` — NUNCA `Math.random().toString(36)`
- **Cookies sysadmin**: `sx-dojo` y `sx-dojo-name` tienen `httpOnly: true` y `secure: true` en producción
- **`tempPassword`** NUNCA debe retornarse en el JSON de respuesta — solo en el correo de bienvenida

---

## Reglas críticas de desarrollo

### Datos y seguridad
1. **Nunca omitir `dojoId`** en queries de Student, Kata, Payment, BeltHistory, Schedule, KataCompetition
2. `dojoId` siempre desde `session.user.dojoId`, nunca del cliente — **excepto sysadmin**: usar `getEffectiveDojoId()` de `src/lib/sysadmin-context.ts`
3. Nuevo modelo de dojo → `dojoId String @map("dojo_id")` + relación con `Dojo`
4. **`sysadmin` contexto de dojo**: opera via cookie `sx-dojo` (set-dojo / exit-dojo). Sin cookie → `getEffectiveDojoId()` retorna `null` → rechazar con 403 y `NO_DOJO_CONTEXT_ERROR`
5. **`photo` NUNCA en selects de lista** — solo en `GET /api/students/[id]` individual
6. **Páginas de edición Server Component**: filtrar con `dojoId` en `findUnique` para evitar mismatch en PUT
7. **Auditoría**: `logAudit()` de `src/lib/audit.ts`. Nunca lanzar error desde logAudit

### Prisma 7
8. `npx prisma db push` para aplicar schema (URL desde `prisma.config.ts` → `.env.local`)
9. `npx prisma generate` después de cualquier cambio al schema
10. **Reiniciar servidor dev** después de `prisma generate` — limpia cliente cacheado en `globalThis`
11. El cliente usa `@prisma/adapter-pg`. NO usar `datasourceUrl` en `new PrismaClient()`
12. El datasource en `schema.prisma` **no lleva `url`** — vive en `prisma.config.ts`

### Modelos específicos
13. **Student.fullName**: campo principal en UI. `firstName`/`lastName` se mantienen por compatibilidad con búsquedas
14. **Schedule.days**: `JSON.stringify(string[])` con `lunes|...`. Parsear con try/catch
15. **Attendance / KataCompetition**: sin `dojoId` directo — filtrar por `student: { dojoId }`
16. **Kata.description**: valores controlados — `"Kata de Cinta"` | `"Kata de Competencias"` | `null`
17. **mustChangePassword**: activo al crear admin. Limpiado en `PUT /api/auth/change-password` → `signOut`
18. **Middleware**: protege `/dashboard/*` y `/portal/*` + rate limiting en scan/attendance/login
19. **Inscription.paymentPeriod**: `"monthly"` (default) | `"biweekly"` — afecta la generación de pagos
20. **BeltHistory.kataIds**: JSON array de IDs para cintas que requieren múltiples katas

### Usuarios — gestión
28. **`User.photo`**: URL Cloudinary (o `null`). Se muestra en la tabla de usuarios y en el avatar del Sidebar/MobileNav via `session.user.image`.
29. **Cambiar contraseña via admin**: `PUT /api/users/[id]` con `{ password, mustChangePassword: true }` → fuerza cambio en próximo login.
30. **Eliminar usuario**: bloqueado si es el último sysadmin. Verificar con `count({ where: { role: "sysadmin" } })`.

### Sistema de Roles y Permisos (RBAC)
31. **`DojoRolePermission`**: tabla de permisos por dojo. `roleName` coincide con `User.role`. Roles del sistema (admin/user) tienen `isSystem=true`.
32. **Roles de sistema**: `sysadmin` (hardcoded total), `admin` (ADMIN_KEYS — ALL_DOJO_KEYS sin SETTINGS_EMAIL/SETTINGS_ROLES), `user` (básico personalizable).
33. **Roles personalizados**: creados por admin, heredan permisos de `user` al crearse. No pueden usar nombres reservados (sysadmin/admin/user/student).
34. **`permissions` JSON**: array de `NavKey[]` — claves definidas en `src/lib/permissions.ts`. Solo controlan visibilidad de navegación, no acceso a APIs.
35. **`usePermissions` hook**: retorna `Set<NavKey>` desde AppContext (ya cargado al montar el dashboard).
36. **Override de sistema**: la primera vez que admin guarda permisos para un rol de sistema, se crea el registro vía `POST /api/roles/system` (upsert). Actualizaciones posteriores via `PUT /api/roles/[id]`.
37. **Asignar rol personalizado**: `User.role` es un string libre — al crear/editar usuario se listan los roles disponibles del dojo (incluyendo custom).
38. **`TOURNAMENTS` NAV_KEY**: excluido de `ALL_DOJO_KEYS` — el acceso a torneos se controla via `Dojo.tournamentPro`, no via permisos granulares.
39. **Sysadmin sin dojo activo** (`SYSADMIN_NO_DOJO_PERMS`): solo ve Dashboard, Dojos, Users, Audit Log, Settings Email.

### ⚠️ REGLA ABSOLUTA — Imágenes y archivos SOLO en Cloudinary

> **NUNCA guardar imágenes, fotos o videos como base64 en la base de datos.**
> La BD almacena únicamente la **URL de Cloudinary** (empieza con `https://res.cloudinary.com/`).

**Flujo obligatorio para cualquier campo de imagen en cualquier formulario:**
1. Usuario selecciona archivo → `<input type="file">`
2. Frontend hace `POST /api/upload` con `FormData: { file, type: "image"|"video" }`
3. API devuelve `{ url: string, publicId: string }`
4. Guardar **solo la URL** en el campo correspondiente de la BD
5. Al eliminar: llamar `deleteResource(publicId)` de `src/lib/cloudinary.ts`

**Campos que deben ser URL Cloudinary (nunca base64):**
- `Student.photo` · `User.photo` · `Dojo.logo` · `Dojo.loginBgImage`
- `Tournament.flyerImage` · `BeltVideo.videoUrl`
- `Event.imageUrl` · `StoreProduct.imageUrl` · `DojoOrganization.logoUrl`
- `ExternalAthlete.photoUrl` · `ExternalClub.paymentProofUrl`
- Cualquier campo de imagen nuevo que se agregue en el futuro

**Detectar base64 legacy:** `value?.startsWith("data:")` → migrar a Cloudinary o mostrar iniciales.

---

### Cloudinary — imágenes y videos
- **`POST /api/upload`**: solo admin/sysadmin. `FormData` con `file` + `type` (image|video). Devuelve `{ url, publicId }`.
- **Fotos de alumnos**: URL Cloudinary guardada en `Student.photo`. Backward compat: si empieza con `data:` es base64 antigua — se renderiza igual con `<img>`.
- **Videos**: modelo `BeltVideo` con `videoUrl` y `publicId`. El `publicId` se usa para borrar en Cloudinary al DELETE.
- **`token.picture`**: se setea en auth.ts jwt() con `student.photo` → mapea a `session.user.image` automáticamente.
- **Acceso a videos del portal**: `GET /api/portal/belt-videos` filtra por `beltHistory` del alumno — solo cintas ya obtenidas.

### Torneos Pro — reglas críticas
- **Una sola ruta de torneos**: todo vive en `/dashboard/tournaments-pro/`. La carpeta `/dashboard/tournaments/` son solo redirects — no agregar funcionalidad ahí nunca.
- **Estado del torneo**: `draft → ready → active → completed ↔ confirmed`. Cambiar con selector en el header del torneo (`PUT /api/tournaments/[id]/status`). `confirmed` solo puede asignarlo sysadmin.
- **`getTournamentStatusFlow()`** en `src/lib/utils.ts`: define transiciones permitidas entre estados. Si se agregan estados nuevos, actualizar esta función.
- **Match activo en tatami**: `TournamentTatami.currentMatchId` debe setearse explícitamente via `PUT /api/tournaments/[id]/tatami/[tatamiId]/active-match`. Sin esto, el overlay OBS no muestra competidores.
- **Display state**: `TournamentTatami.matchDisplayState` controla pantalla TV — cambiar via `PUT /api/tournaments/[id]/tatami/[tatamiId]/display-state`. El overlay OBS y la pantalla TV se adaptan automáticamente.
- **Stream status**: `offline → live → finished`. Si queda en `finished`, botón "↺ Reiniciar" vuelve a `offline`. Afecta solo el badge "EN VIVO" — los datos del combate se muestran igual.
- **API tatami-display pública**: solo devuelve datos de participantes si torneo está en `ready/active/completed/confirmed`. En `draft` devuelve solo info del tatami (para setup).
- **`match-senshu` API pública**: requiere `judgeId` válido del mismo torneo — no puede ser llamada sin autenticación de juez.
- **Overlay OBS**: usar URL `/tournament/[id]/overlay/[tatamiId]`. Obtener URL desde `/tournament/[id]/overlay` (requiere login). En OBS: Browser Source **1920×1080** (o usar `overlayPreset` del tatami), activar "Enable Background Transparency".
- **Categorías WKF**: usar `buildCategoryLabel()` de `src/lib/tournament-categories.ts` — nunca generar el nombre manualmente. El formulario de bracket tiene dropdowns encadenados ageGroup → weightCategory.
- **Torneos abiertos**: `ExternalClub.accessToken` NUNCA se retorna al organizador. `ExternalAthlete.documentId` NUNCA se incluye en queries de lista. `accreditationPin` NUNCA se expone en APIs públicas.
- **QR de acreditación**: solo se genera cuando `club.status=approved AND paymentStatus=paid|waived`. El QR contiene solo el código corto, nunca datos personales.
- **Coach token**: `dojoId` SIEMPRE presente en el JWT del coach — validar en CADA request de las APIs del coach que `club.dojoId === payload.dojoId`.
- **Ranking seeding**: `rankingSeed` solo el organizador puede asignarlo (no el coach). Máximo 4 seeds por bracket. `distributeParticipantsWithSeeds()` en `tournament-seeding.ts` se llama automáticamente al generar el bracket cuando algún participante tiene `seed > 0`. Sin seeds → shuffle aleatorio.
- **TournamentParticipant.weight**: campo Float opcional para peso del competidor en kg (se muestra en overlay y credencial).
- **`videoReviewEnabled` / `obsRecordingPath`**: se activan/editan en tab "En Vivo" → sección tatami → caja azul "Video Review". Sin activar este toggle, el botón de video review NO aparece en la app del juez.
- **App del juez — categoría**: flujo de 3 pasos: seleccionar juez → pantalla de categoría → puntuar. Botón "← Cat." permite regresar. Si cambia el bracket activo, regresa automáticamente a la pantalla de categoría.
- **`verifyTournamentOwnership()`** en `src/lib/tournament-security.ts`: usar en TODA API admin que recibe `tournamentId`. Nunca confiar en el `tournamentId` del cliente.
- **Portal alumno En Vivo**: `GET /api/portal/live-tatamis` solo devuelve tatamis con `streamStatus=live` Y `youtubeVideoId != null`. NUNCA devuelve `youtubeStreamKey`.
- **Hantei**: solo aplica a Kumite (`isBracketElimination("kumite") === true`). `requiresHantei()` se valida server-side. Votos individuales de jueces NUNCA se exponen antes de `hanteiStatus="decided"`. El árbitro (role=shushin/referee) tiene el voto de desempate en caso 2-2. `logAudit()` en HANTEI_CALLED y HANTEI_DECIDED.

### Gestión de dojos (sysadmin)
- **`DELETE /api/dojos/[id]`**: elimina dojo + toda su data en cascada en una `$transaction` de 30s. Orden: tournaments → students → users → katas → schedules → etc. → dojo. Ver `src/app/api/dojos/[id]/route.ts` para el orden exacto.
- La UI pide confirmación escribiendo el nombre exacto del dojo antes de habilitar el botón.
- El evento `DOJO_DELETED` queda en audit_log.

### Importación masiva (Excel)
- **`parseDate`** en `src/lib/student-import.ts` acepta: `DD/MM/AAAA`, `DD-MM-AAAA`, `DD.MM.AAAA`, `AAAA-MM-DD`, `DD/MM/AA` (2 dígitos). Valida días y meses fuera de rango.
- **`getCell`** en el import route usa `getUTCDate()/getUTCMonth()/getUTCFullYear()` para Date objects de ExcelJS — evita desfase de zona horaria (UTC-5 en Panama).
- **Modo actualización**: `POST /api/students/import` con `FormData.mode=update` actualiza alumnos existentes (por cédula) en lugar de omitirlos.
- **Columna de fecha en Excel**: si la celda está formateada como fecha (tipo Date en ExcelJS), se usa directamente. Si es serial numérico (rango 15000-60000), se convierte via epoch de Excel (25569 días desde Unix epoch).

### Rendimiento
- **Nunca fetch en `useEffect` para carga inicial** si la página puede ser Server Component
- **`useDojo`**: consume AppContext (cargado una vez al montar el dashboard shell)
- **`GET /api/dojo`**: excluye `logo` y `loginBgImage` por defecto — `?logo=1` solo en Settings
- **`GET /api/katas?active=1`**: usa `unstable_cache` 10 min con tag `katas-{dojoId}`
- **Invalidar caché**: `revalidateTag(CACHE_TAGS.katas(dojoId))` en POST/PUT/DELETE katas
- **Invalidar caché dojo**: `revalidateTag(CACHE_TAGS.dojo(dojoId))` en PUT /api/dojo
- Toda ruta nueva del dashboard → `loading.tsx` obligatorio con skeleton
- Listados puros → Server Components. CRUDs con modales → Client Components
- `overflow-x-auto` en todos los wrappers de tabla — `overflow-x-hidden` en layout main

---

## Índices en PostgreSQL (aplicados)

```
students: (dojoId, active), (dojoId, lastName, firstName), (dojoId, fullName), (dojoId, active, fullName)
payments: (studentId), (studentId, status, dueDate), (status, dueDate), (reminderSent, status, dueDate)
belt_history: (studentId, changeDate)
attendances: (studentId, markedAt), (scheduleId, markedAt), (studentId, type, markedAt)
katas: (dojoId), (beltColor), (dojoId, active), unique(name, dojoId)
kata_competitions: (studentId), (date)
users: (email), (dojoId), (dojoId, active), (dojoId, role)
tournament_brackets: (tournamentId), **(tournamentId, status)**
tournament_matches: (tournamentId, round), (bracketId), **(tatamiId, winnerId)**, (bracketId, round, matchNumber)
tournament_judge_scores: (matchId), (judgeId), (tatamiId), unique(matchId, judgeId)
tournament_registrations: (tournamentId), **(tournamentId, status)**
external_athletes: (tournamentId), (dojoId), (externalClubId), **(externalClubId, status)**, (qrCode)
audit_logs: (userId), (action), **(module)**, **(resourceType, resourceId)**, **(ip)**, **(sessionId)**, (createdAt), **(dojoId, createdAt)**
```

Los índices en **negrita** fueron agregados en esta sesión para mejorar rendimiento en las queries más frecuentes.

---

## Recordatorios y recibos de pago

### Recordatorio individual
1. Botón "Recordatorio" en cada fila (siempre visible) → modal de confirmación
2. Modal muestra: alumno, acudiente(s) con correo, monto, vencimiento
3. Si no hay correos: aviso rojo, botón "Enviar" deshabilitado
4. Confirmar → `POST /api/payments/remind { paymentId }`

### Generación mensual (sin N+1)
- `POST /api/payments/generate` → 3 queries totales usando `createMany + skipDuplicates`
- Soporta `paymentPeriod = "biweekly"` → genera dos pagos por mes (días 1 y 15)
- Botón "Generar Mensualidades" en la página de pagos

### Recibo de pago
- Aparece botón "Enviar Recibo" al marcar pago como pagado
- `POST /api/payments/receipt { paymentId }` → envía correo con recibo HTML firmado

---

## Scanner QR (`/scanner`)
- Usa `html5-qrcode` con cámara del dispositivo
- Flujo: selección de clase → cámara activa → overlay de resultado
- `GET /api/scan?id=X&scheduleId=Y`: acepta studentCode numérico O cuid. Si NOT_ASSIGNED: status 200 con `{ code: "NOT_ASSIGNED" }`
- Entrada manual: sección colapsable bajo el visor, soporta ID o código numérico
- `POST /api/attendance` es público — rate limit 120/min por IP

---

## Alumnos — funcionalidades

### Filtros en la lista
1. **Toggle activos/inactivos/todos** — hace fetch al cambiar
2. **Búsqueda por nombre** — debounce 300ms
3. **Filtro por cinta** — chips client-side, solo muestra cintas con alumnos

### Activar/Desactivar alumno
- Botón en perfil: "Desactivar" (rojo) o "Activar" (verde) con confirmación
- Banner rojo en perfil cuando está inactivo
- Inactivos no aparecen en scanner ni en lista activa por defecto

---

## Gestión de Katas

### Catálogo (`/dashboard/katas`) — solo lectura
- Muestra katas activos agrupados por cinta (usa `?active=1` — caché)

### Creación de Katas (`/dashboard/settings/katas`) — CRUD completo
- Tipo de Kata: dropdown `"Kata de Cinta"` | `"Kata de Competencias"` | sin tipo
- Los modales de selección en el perfil filtran por tipo

---

## Diseño / Tokens
- Colores: `dojo-red`, `dojo-dark`, `dojo-darker`, `dojo-card`, `dojo-gold`, `dojo-white`, `dojo-muted`, `dojo-border`
- Utilitarios: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.form-input`, `.form-label`
- Badges: `.badge-red`, `.badge-yellow`, `.badge-green`, `.badge-blue`, `.badge-gold`
- Fuentes: **Cinzel** (`font-display`), **Nunito** (`font-body`)
- Skeletons: `bg-dojo-border/60 rounded animate-pulse` (primario), `/40` (secundario)
- Mobile: `block lg:hidden` / `hidden lg:block` para alternar vistas. `min-h-[100dvh]` en login

---

## Tablas PostgreSQL
| Tabla | Campos destacados |
|-------|-------------|
| `dojos` | `email`, `slogan`, `owner_name`, `phone`, `instagram_url`, `logo`(Cloudinary URL), `login_bg_image`(Cloudinary URL), `theme_id`(default: dark-saas), `locale`(default: es), `tournament_pro`(bool), params recordatorios |
| `users` | `role`, `dojoId`, `mustChangePassword`, `photo`(Cloudinary URL), `student_id`(optional link) |
| `students` | `full_name`, `studentCode`(≥1000), `cedula`, `fepaka_id`, `ryo_bukai_id`, `birth_date`, `gender`, `nationality`, `condition`, `blood_type`, `has_private_insurance`, `insurance_name`, `insurance_number`, `mother_name/phone/email`, `father_name/phone/email`, `address`, `photo`(Cloudinary URL), `active`, `attendance_status` |
| `inscriptions` | `annualAmount`, `monthlyAmount`, `discountAmount`, `discountNote`, `payment_period`(monthly/biweekly), `biweekly_amount` |
| `payments` | `type`(monthly/annual/biweekly), `status`(pending/paid/late), `reminderSent` |
| `belt_history` | `beltColor`, `changeDate`, `kataId`, `kata_ids`(JSON), `isRanking`, `notes` |
| `katas` | `name`, `beltColor`, `order`, `description`, `dojoId` — unique(name,dojoId) |
| `kata_competitions` | `studentId`, `kataId`, `date`, `tournament`, `result`, `notes` |
| `schedules` | `days`=JSON, `startTime`, `endTime`, `dojoId` |
| `attendances` | `type`(entry/exit), `corrected`, `correctedBy`; sin `dojoId` directo |
| `student_schedules` | join Student ↔ Schedule |
| `audit_logs` | `action`, `module`, `method`, `resource_type`, `resource_id`, `status_code`, `userId`, `user_name`, `userEmail`, `is_sysadmin_proxy`, `dojoId`, `dojoSlug`, `target_id`, `target_email`, `ip`, `userAgent`, `country`, `city`, `region`, `session_id`, `duration`, `details`(JSON before/after), `hash`(SHA-256) |
| `email_settings` | `host`, `port`, `user`, `password`(**cifrado AES-256**), `secure`, `fromName` |
| `belt_videos` | `dojoId`, `beltColor`, `title`, `description`, `videoUrl`, `publicId`(Cloudinary), `order`, `active` |
| `dojo_role_permissions` | `dojoId`, `roleName`, `roleLabel`, `roleColor`, `isSystem`, `permissions`(Json→NavKey[]) |
| `events` | `dojoId`, `title`, `description`, `location`, `image_url`(Cloudinary URL), `start_date`, `end_date` |
| `dojo_pages` | `dojoId`(unique), `published`, `hero_title/subtitle/image`, `about_text/image`, `primary_color`, toggles(show_free_trial/schedules/contact/store), `address`, `gallery_images`(JSON), `stats`(JSON), `testimonials`(JSON), `sensei`(JSON) |
| `dojo_organizations` | `dojoId`, `name`, `logo_url`(Cloudinary URL), `order` |
| `store_products` | `dojoId`, `name`, `description`, `price`, `currency`, `image_url`, `sizes`(JSON), `active`, `order` |
| `free_trial_requests` | `dojoId`, `child_name`, `child_age`, `parent_name/phone/email`, `status`, `schedule_id`, `notes`, `read` |
| `tournaments` | `dojoId`, `name`, `date`, `location`, `organization`, `leader1/2/3`, `tatami`, `flyer_image`, `status`, `bracket_locked`, `archived_at`, `is_public`, `public_slug`, `registration_open/close_at`, `tournament_type`(internal/open/federated), `entry_fee_per_category`, `fee_currency`, `require_photo/federation_id/waiver`, `waiver_text`, `max_athletes_per_club`, `max_total_athletes`, `accreditation_pin` |
| `tournament_brackets` | `tournament_id`, `name`, `type`(kumite/kata), `gender`(M/F/null), `order`, `bracket_locked`, `status`, `age_group`, `weight_category`, `belt_category`, `is_team_kata`, `category_label`, `bracket_order` |
| `tournament_participants` | `tournament_id`, `student_id`, `bracket_id`, `seed`, `weight`, `qr_code`, `accredited_at`, `credential_sent_at`, `kiken_at` |
| `tournament_matches` | `tournament_id`, `bracket_id`, `tatami_id`, `round`, `match_number`, `participant1/2_id`, `score1/2`, `winner_id`, `is_bye`, `senshu`, `hantei_status`, `hantei_winner_id`, `hantei_votes_ao/aka`, `hantei_called/decided_at` |
| `tournament_judge_scores` | `match_id`, `judge_id`, `tatami_id`, `score_type`, ippon/wazaari/yuko x2, chukoku/hansoku x2, `kata_score1/2` |
| `hantei_votes` | `match_id`, `judge_id`, `tournament_id`, `dojo_id`, `vote`(ao/aka), `is_referee`, `voted_at` — unique(matchId, judgeId) |
| `tournament_judges` | `dojoId`, `tournament_id`, `tatami_id`, `name`, `role`, `license_no`, `nationality`, `active` |
| `tournament_referees` | `tournament_id`, `name`, `order` |
| `tournament_tatamis` | `dojoId`, `tournament_id`, `name`, `order`, `color`, streaming fields, timer fields, `match_display_state`, `winner_participant_id`, `winner_reason`, `match_won_at`, `overlay_width/height/scale/preset` |
| `tournament_streams` | `tournament_id`(unique), `dojoId`, `youtube_video_id`, `status`, `active_overlay` |
| `tournament_schedule_slots` | `tournament_id`, `tatami_id`, `start_time`, `end_time`, `event_type`, `title` |
| `tournament_registrations` | `tournament_id`, `dojoId`, guest fields, `categories`, `status` |
| `tournament_email_logs` | `tournament_id`, `student_id`, `email`, `status`, `error` |
| `external_clubs` | `dojoId`(anfitrión), `tournament_id`, `club_name`, `coach_name/email/phone`, `federation_id`, `access_token`(JWT), `access_expires`, `status`(pending/approved/rejected/waitlist), `payment_status`, `payment_proof_url`, `rejection_reason` |
| `external_athletes` | `dojoId`(anfitrión), `tournament_id`, `external_club_id`, `first/last_name`, `birth_date`, `gender`, `nationality`, `weight`, `belt_color`, `fepaka_id`, `photo_url`, `age_group`, `status`, `waiver_signed/at/ip`, `qr_code`, `accredited_at`, `credential_sent_at`, `kiken_at`, `bracket_id` |
| `external_athlete_categories` | `dojoId`(anfitrión), `tournament_id`, `athlete_id`, `bracket_id`, `category_label`, `status`, `fee_amount`, `payment_status`, `is_ranking`, `ranking_validated`, `ranking_note`, `ranking_seed`, `bracket_seed/position` |

---

## Estructura de archivos clave
```
src/
├── app/
│   ├── page.tsx                    ← Landing page principal (venta del producto)
│   ├── register/page.tsx           ← Registro público de usuarios
│   ├── dojo/[slug]/
│   │   ├── page.tsx                ← Página pública del dojo (SSR, acepta ?preview=1)
│   │   ├── DojoPublicPage.tsx      ← Componente principal página pública
│   │   ├── login/page.tsx          ← Login exclusivo del dojo con branding propio
│   │   └── not-found.tsx
│   ├── public/tournament/[slug]/
│   │   ├── page.tsx                ← Vista pública torneo + inscripciones individuales + clubs externos
│   │   ├── ClubRegistrationSection.tsx ← Formulario inscripción de clubs externos (Client Component)
│   │   └── scoreboard/page.tsx     ← Marcador público del torneo
│   ├── coach/[token]/
│   │   ├── page.tsx                ← Portal del coach (standalone, sin NextAuth)
│   │   ├── loading.tsx             ← Skeleton oscuro con header + tabs
│   │   ├── CoachPortalClient.tsx   ← 4 tabs: Atletas | Pago | Estado | Info
│   │   ├── AddAthleteModal.tsx     ← Modal 3 pasos: datos → categorías → confirmación
│   │   ├── PaymentTab.tsx          ← Referencia + upload comprobante
│   │   └── StatusTimeline.tsx      ← Timeline visual del estado
│   ├── tournament/[id]/
│   │   ├── judge/page.tsx          ← App de juez (sin nav)
│   │   │                              Flujo: seleccionar juez → categoría activa → puntuar
│   │   │                              Botón "📹 Solicitar Video Review" si videoReviewEnabled=true
│   │   ├── overlay/
│   │   │   ├── page.tsx            ← SELECTOR de tatamis con URLs OBS (requiere login)
│   │   │   └── [tatamiId]/page.tsx ← Overlay OBS por tatami (sin auth)
│   │   │                              Muestra: tatami, bracket, timer, tarjetas AO/AKA
│   │   │                              Fetches: GET /api/public/tatami-display/[tatamiId]
│   │   └── tatami/[tatamiId]/
│   │       └── display/page.tsx    ← Pantalla/TV del tatami (sin auth)
│   │                                  Estados: idle|active|winner|next_preview
│   │                                  Banner VIDEO REVIEW cuando reviewStatus≠"none"
│   ├── tournament/[id]/accredit/
│   │   └── page.tsx                ← Scanner de acreditación (sin auth, requiere PIN)
│   │                                  html5-qrcode + entrada manual + estados OK/WARNING/ERROR
│   ├── dashboard/
│   │   ├── layout.tsx              ← min-w-0 overflow-x-hidden en main; HelpButton global
│   │   ├── page.tsx                ← Server Component; DashboardMobileCards al inicio
│   │   ├── students/
│   │   │   ├── page.tsx            ← Server Component (datos iniciales activos)
│   │   │   ├── StudentsClient.tsx  ← filtros: búsqueda, activo/inactivo, cinta (client-side)
│   │   │   └── [id]/
│   │   │       ├── page.tsx        ← Client Component (perfil + activar/desactivar + acceso portal)
│   │   │       └── edit/page.tsx   ← Server Component (fullName precargado)
│   │   ├── payments/page.tsx       ← vista mobile en tarjetas + lg tabla
│   │   ├── leads/page.tsx          ← CRM prospectos — FreeTrialRequest con flujo de estado
│   │   ├── store/page.tsx          ← Tienda del dojo — CRUD productos
│   │   ├── tournaments/
│   │   │   ├── page.tsx            ← REDIRECT → /dashboard/tournaments-pro
│   │   │   ├── new/page.tsx        ← REDIRECT → /dashboard/tournaments-pro/new
│   │   │   └── [id]/page.tsx       ← REDIRECT → /dashboard/tournaments-pro/[id]
│   │   ├── tournaments-pro/        ← ÚNICO sistema de torneos real
│   │   │   ├── page.tsx            ← Lista torneos Pro + modal onboarding (primera visita)
│   │   │   ├── loading.tsx
│   │   │   ├── new/page.tsx        ← Formulario de creación (ÚNICO — no duplicar)
│   │   │   ├── new/loading.tsx     ← Skeleton del formulario
│   │   │   └── [id]/page.tsx       ← Gestión completa: info, atletas, kumite, kata,
│   │   │                              tatamis (con toggle videoReview+obsPath), en-vivo, inscripciones, resultados.
│   │   │   └── [id]/InscripcionesTab.tsx ← Gestión clubs externos: aprobar/rechazar/pagar/credenciales
│   │   ├── settings/
│   │   │   ├── page.tsx            ← logo, email dojo, bg login, params, idioma
│   │   │   ├── public-page/page.tsx ← Editor página pública (hero, about, galería, sensei, tienda)
│   │   │   ├── katas/page.tsx      ← CRUD katas con tipo dropdown
│   │   │   ├── videos/page.tsx     ← Videos por cinta
│   │   │   ├── email/page.tsx      ← SMTP: host, port, user, pass, security(radio), test
│   │   │   └── roles/page.tsx      ← Roles y accesos
│   │   ├── katas/page.tsx          ← Solo lectura con overflow-x-auto
│   │   └── [ruta]/loading.tsx      ← Skeleton en todas las rutas
│   ├── portal/
│   │   ├── layout.tsx              ← PortalNav
│   │   ├── PortalNav.tsx           ← tabs: Perfil, Pagos, Horarios, Asistencia, Videos, Eventos
│   │   ├── page.tsx                ← Perfil del alumno
│   │   ├── change-password/
│   │   ├── payments/               ← Historial de pagos propios
│   │   ├── attendance/             ← Historial de asistencia propia
│   │   ├── schedules/              ← Horarios asignados
│   │   ├── videos/                 ← Videos de katas (solo cintas obtenidas)
│   │   └── events/                 ← Eventos del dojo (tabs: Próximos / Historial) [Client]
│   ├── scanner/page.tsx            ← html5-qrcode, entrada manual, overlays resultado
│   └── api/
│       ├── dojo/
│       │   ├── route.ts            ← revalidateTag(dojo) en PUT
│       │   └── theme/route.ts      ← PUT: cambiar tema
│       ├── dojo-page/route.ts      ← GET/PUT configuración página pública (upsert)
│       ├── dojo-organizations/     ← CRUD federaciones/organizaciones del dojo
│       ├── store-products/         ← CRUD productos de tienda
│       ├── leads/                  ← CRM prospectos (GET marca read=true)
│       ├── notifications/route.ts  ← Alertas: pagos atrasados + asistencia + seguridad
│       ├── audit-logs/route.ts     ← Log auditoría (sysadmin)
│       ├── sysadmin/
│       │   ├── set-dojo/route.ts   ← Setea cookie sx-dojo para contexto sysadmin
│       │   └── exit-dojo/route.ts  ← Borra cookie sx-dojo
│       ├── tournaments/            ← CRUD completo torneos + brackets + matches + tatamis + judges
│       │   └── [id]/
│       │       ├── matches/[mId]/judge-scores/route.ts ← Puntuaciones de jueces
│       │       ├── external-clubs/route.ts              ← Lista clubs externos (admin)
│       │       ├── external-clubs/[clubId]/route.ts     ← CRUD club externo
│       │       ├── external-clubs/[clubId]/send-credentials/route.ts ← Genera QRs + envía emails
│       │       └── tatami/[tId]/
│       │           ├── active-match/route.ts   ← Match activo (real-time)
│       │           ├── timer/route.ts          ← Control del timer
│       │           ├── stream/route.ts         ← Config stream por tatami
│       │           └── display-state/route.ts  ← Estado pantalla TV (v2.0)
│       ├── portal/
│       │   └── live-tatamis/route.ts ← Tatamis en vivo para alumno (v2.0)
│       ├── public/
│       │   ├── dojo-page/route.ts    ← Página pública sin auth (?slug=)
│       │   ├── store/route.ts        ← Productos activos sin auth (?slug=)
│       │   ├── free-trial/route.ts   ← Crear solicitud prueba gratis (sin auth)
│       │   ├── register/route.ts     ← Registro público de usuarios (sin auth)
│       │   ├── judge-app/[tournamentId]/route.ts  ← Info app de juez (sin auth)
│       │   ├── tatami-display/[tatamiId]/route.ts ← Datos display tatami (sin auth)
│       │   ├── match-senshu/route.ts              ← Marcar senshu (requiere judgeId)
│       │   ├── tournament-club/[token]/route.ts   ← Portal coach: datos club (JWT)
│       │   ├── tournament-club/[token]/athletes/  ← Coach agrega/edita atletas
│       │   ├── tournament-club/[token]/payment/   ← Coach sube comprobante pago
│       │   ├── tournament-accredit/[qrCode]/route.ts ← Scanner entrada torneo (v2.1)
│       │   ├── tournaments/[slug]/register-club/  ← Registro inicial de club (rate 5/min)
│       │   ├── tournaments/[slug]/
│       │   │   ├── route.ts          ← Info torneo público
│       │   │   ├── register/route.ts ← Inscripción federativa pública
│       │   │   ├── stream/route.ts   ← Info stream pública
│       │   │   └── scoreboard/route.ts ← Scoreboard público
│       │   ├── dojo/[slug]/route.ts
│       │   └── login-bg/route.ts
│       ├── students/[id]/access/route.ts ← POST: crear acceso portal; DELETE: desactivar
│       ├── katas/
│       │   ├── route.ts            ← ?active=1 usa getCachedKatas(); sin param: Prisma directo
│       │   └── [id]/route.ts       ← revalidateTag(katas) en PUT/DELETE
│       ├── payments/
│       │   ├── route.ts
│       │   ├── generate/route.ts   ← createMany (sin N+1) + biweekly support
│       │   ├── remind/route.ts
│       │   └── receipt/route.ts
│       ├── attendance/
│       │   ├── route.ts
│       │   └── weekly/route.ts     ← Asistencia semanal agrupada
│       ├── admin/email-settings/
│       │   ├── route.ts            ← cifra contraseña con encrypt()
│       │   └── test/route.ts       ← descifra con decrypt() para test
│       └── health/route.ts         ← GET: health check
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             ← nav filtrado por permisos + tournamentPro gate
│   │   ├── MobileNav.tsx           ← botón back; mismos ítems que Sidebar
│   │   └── TopBar.tsx              ← título dinámico + breadcrumb + fecha + Bell notificaciones
│   ├── dashboard/
│   │   ├── DashboardStats.tsx      ← KPI cards con .stat-icon-circle
│   │   ├── AttendanceChart.tsx     ← Recharts; colores via MutationObserver en #dojo-shell
│   │   └── DashboardMobileCards.tsx ← tarjetas mobile (block lg:hidden)
│   ├── ui/
│   │   ├── HelpButton.tsx          ← botón ? fixed bottom-right; oculto si no hay contenido
│   │   ├── HelpDrawer.tsx          ← panel lateral; text-dojo-sidebar-text para todos los temas
│   │   ├── ThemeSwitcher.tsx       ← selector de tema en TopBar (admin/sysadmin)
│   │   └── Modal.tsx               ← modal reutilizable con size: sm|md|lg
│   ├── students/
│   │   └── StudentForm.tsx         ← fullName único, condition, bloodType, insuranceNumber, contactos
│   └── tournaments/
│       ├── BracketView.tsx              ← visualización del bracket kumite (árbol)
│       ├── KataOrderList.tsx            ← lista ordenada para kata bracket
│       ├── TournamentSettings.tsx       ← config del torneo
│       ├── TournamentStream.tsx         ← interfaz streaming (con botón ↺ Reiniciar)
│       ├── TournamentOnboardingVideo.tsx← modal bienvenida (v2.0) — localStorage flag
│       └── OBSSetupGuide.tsx            ← guía 3 pasos OBS (v2.0) — en selector overlay
├── app/
│   ├── coach/[token]/               ← Portal coach standalone (sin NextAuth, sin layout dashboard)
│   │   ├── page.tsx                 ← Server Component: valida token, carga datos
│   │   ├── CoachPortalClient.tsx    ← Client: tabs Atletas|Pago|Estado|Info
│   │   ├── AddAthleteModal.tsx      ← Modal 3 pasos: datos → categorías → waiver
│   │   ├── PaymentTab.tsx           ← Resumen pago + upload comprobante
│   │   └── StatusTimeline.tsx       ← Timeline visual del estado de inscripción
│   ├── portal/live/
│   │   ├── page.tsx                 ← Grid tatamis en vivo (polling 30s)
│   │   ├── loading.tsx
│   │   └── [tatamiId]/page.tsx      ← Embed YouTube + info tatami
│   └── tournament/[id]/
│       └── accredit/page.tsx        ← Scanner acreditación entrada (sin NextAuth, requiere PIN)
└── lib/
    ├── prisma.ts
    ├── auth.ts                      ← incluye token.picture = student.photo para avatar en JWT
    ├── email.ts                     ← createTransporter() descifra password; fromAddress() usa dojo.email
    ├── email/tournamentEmailService.ts ← emails específicos de torneos
    ├── crypto.ts                    ← encrypt/decrypt AES-256-CBC con ENCRYPTION_KEY
    ├── cloudinary.ts                ← uploadBuffer(), deleteResource() — usa CLOUDINARY_* env vars
    ├── sysadmin-context.ts          ← getEffectiveDojoId() + NO_DOJO_CONTEXT_ERROR
    ├── permissions.ts               ← NAV_KEYS, DEFAULT_PERMISSIONS, ALL_DOJO_KEYS, ADMIN_KEYS, resolvePermissions()
    ├── queries.ts                   ← getCachedKatas(), getCachedDojoMeta(), CACHE_TAGS
    ├── i18n.ts                      ← traducciones estáticas es/en, getT(locale)
    ├── bracketUtils.ts              ← lógica de generación y cálculo de brackets
    ├── bracketColors.ts             ← colores para visualización de brackets
    ├── sounds.ts                    ← manejo de sonidos para notificaciones
    ├── audit.ts
    ├── utils.ts                     ← BELT_COLORS (18 cintas), getTournamentStatusFlow()
    ├── help-content.ts              ← HELP_CONTENT[pathname] + getHelpContent(pathname)
    ├── env.ts                       ← validación y tipado de variables de entorno
    ├── tournament-categories.ts     ← AGE_GROUPS, WEIGHT_CATEGORIES, BELT_CATEGORIES, OVERLAY_PRESETS (v2.0)
    │                                   buildCategoryLabel(), calculateAgeGroup(), getCompatibleCategories()
    │                                   getRoundLabel(), getWinnerReasonText()
    ├── coach-token.ts               ← generateCoachToken(), validateCoachToken(), requireCoachToken() (v2.0)
    │                                   JWT firmado 30 días con dojoId, clubId, tournamentId
    ├── tournament-security.ts       ← verifyTournamentOwnership(), verifyClubOwnership() (v2.0)
    │                                   verifyAthleteOwnership(), checkRateLimit()
    ├── tournament-qr.ts             ← generateAthleteQRCode(), generateQRImageDataURL() (v2.1)
    │                                   buildCredentialEmailHTML() — dep: qrcode npm package
    ├── tournament-seeding.ts        ← distributeParticipantsWithSeeds() (v2.1)
    │                                   Seed positions WKF para brackets 4/8/16/32/64
    │                                   Conectado automáticamente al API de generación de bracket
    │                                   Si seed>0 en algún participante → posición fija; si no → shuffle
    ├── hantei.ts                    ← Sistema Hantei WKF (判定)
    │                                   requiresHantei(), calculateHanteiResult(), getHanteiDisplayText()
    │                                   HANTEI_PANEL_SIZES (standard=4, small=3, minimal=1)
    ├── video-review.ts              ← calculateReviewOffset(), buildYouTubeEmbedUrl(), formatReviewOffset()
    │                                   buildOBSSeekInstruction(), YOUTUBE_LATENCY_BUFFER_SECS=35
    ├── context/
    │   └── AppContext.tsx           ← Provider global: dojoInfo + permissions (cargado una vez)
    └── hooks/
        ├── useDojo.ts               ← consume AppContext → DojoInfo (incl. locale, tournamentPro)
        ├── usePermissions.ts        ← consume AppContext → Set<NavKey>
        ├── useLocale.ts             ← usa useDojo().locale → { locale, t: Translations }
        └── useTheme.ts              ← setTheme() actualiza DOM (#dojo-shell) + guarda en DB
```

---

## ⚠️ REGLA DE DESPLIEGUE — Leer antes de hacer push

**NUNCA ejecutar `git push` sin autorización explícita del usuario.**

Vercel está conectado a la rama `main` y despliega automáticamente al detectar cualquier push.
El usuario necesita probar los cambios localmente antes de enviarlos a producción.

**Flujo obligatorio:**
1. Hacer los cambios y commits localmente
2. Preguntar al usuario: *"¿Autorizo el push a GitHub? Eso activará el deploy en Vercel."*
3. Esperar confirmación explícita antes de ejecutar `git push`

Esto aplica para cualquier push, incluyendo commits vacíos de "trigger deploy".
