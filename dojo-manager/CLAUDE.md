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
        │                 ├── Payment[]        (últimos 24 en perfil)
        │                 ├── BeltHistory[]    (últimos 50 en perfil)
        │                 ├── KataCompetition[] (últimos 50 en perfil)
        │                 ├── Attendance[]
        │                 └── StudentSchedule[]
        ├── Kata[]       ──┬── BeltHistory[]
        │                  └── KataCompetition[]
        ├── Schedule[]  ──── StudentSchedule[]
        └── (email, logo, loginBgImage, params recordatorios)
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
fullName     String   @default("") @map("full_name") // campo principal — firstName+lastName se mantienen por compatibilidad
studentCode  Int?     @unique          // auto-incremental desde 1000
cedula       String?
fepakaId     String?  @map("fepaka_id")    // ≤15 chars, MAYÚSCULAS
ryoBukaiId   String?  @map("ryo_bukai_id") // ≤15 chars, MAYÚSCULAS
condition    String?                   // condición de salud (antes allergy1)
bloodType    String?  @map("blood_type")   // O+/O-/A+/A-/B+/B-/AB+/AB-
insuranceNumber String? @map("insurance_number") // ≤25 chars alfanumérico
photo        String?  @db.Text         // base64 — NUNCA retornar en listas
active       Boolean  @default(true)
```
- `fullName` es el campo principal en la UI. `firstName`/`lastName` se guardan también para compatibilidad con búsquedas y APIs heredadas
- `fepakaId` y `ryoBukaiId`: siempre en MAYÚSCULAS (API hace `.toUpperCase()`)
- `studentCode`: `aggregate({ _max: { studentCode } })` + 1, mínimo 1000
- **`photo` NUNCA debe incluirse en queries de lista** — solo en `GET /api/students/[id]`

### Dojo
```prisma
email         String?              // FROM address para correos del dojo
logo          String?  @db.Text    // base64 — excluir por defecto (?logo=1 para incluir)
loginBgImage  String?  @db.Text    // imagen de fondo del login mobile
reminderToleranceDays Int @default(5)
lateInterestPct       Float @default(10.0)
autoRemindersEnabled  Boolean @default(false)
```

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

---

## Cintas disponibles (BELT_COLORS en utils.ts)
```
blanca → blanca-celeste → blanco-amarillo → amarilla → naranja → verde →
azul → morada → café → café-1-raya → café-2-rayas → café-3-rayas →
negra → negra-1-dan → negra-2-dan → negra-3-dan
```
- `blanca-celeste` hex `#87CEEB`, `blanco-amarillo` hex `#FFE566`
- Siempre usar los `value` del array, no strings arbitrarios

---

## Rutas de la aplicación

### Dashboard (roles: sysadmin / admin / user)
```
/login                               → Login (acepta ?dojo=slug, muestra bg image si configurada)
/forgot-password                     → Solicitud de recuperación de contraseña
/reset-password                      → Reseteo de contraseña con token
/dashboard                           → Inicio/métricas         [Server Component]
/dashboard/change-password           → Cambio obligatorio de contraseña
/dashboard/students                  → Alumnos [Server+Client] filtros: búsqueda, activo/inactivo, cinta
/dashboard/students/new              → Nuevo alumno
/dashboard/students/[id]             → Perfil alumno — activo/desactivar + historial completo
/dashboard/students/[id]/edit        → Editar alumno           [Server Component]
/dashboard/payments                  → Pagos + recordatorios + recibos + generación mensual
/dashboard/belts                     → Historial de rangos (todos los alumnos)
/dashboard/schedules                 → Horarios de clases (CRUD)
/dashboard/attendance                → Registro de asistencia
/dashboard/katas                     → Catálogo de katas [solo lectura — sub-menú Configuración]
/dashboard/reports                   → Reportes
/dashboard/users                     → Usuarios del dojo
/dashboard/dojos                     → Gestión de dojos (sysadmin)
/dashboard/settings                  → Config general (logo, email dojo, params pago, bg login)
/dashboard/settings/katas            → Creación y gestión de katas [CRUD]
/dashboard/settings/email            → Parámetros de correo SMTP (admin + sysadmin)
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
```
- El middleware redirige `role === "student"` desde `/dashboard` → `/portal`
- `PortalNav.tsx` en `src/app/portal/` maneja la navegación

**Cada ruta del dashboard tiene `loading.tsx`** con skeleton.

### Sidebar / MobileNav — navegación
- **Configuración** es grupo expandible con sub-ítems:
  - General → `/dashboard/settings`
  - Creación de Katas → `/dashboard/settings/katas` (admin/sysadmin)
  - Videos por Cinta → `/dashboard/settings/videos` (admin/sysadmin)
  - Parámetros de Correo → `/dashboard/settings/email` (admin/sysadmin)
  - Roles y Accesos → `/dashboard/settings/roles` (admin/sysadmin)
  - Catálogo de Katas → `/dashboard/katas` (todos los roles)
- Se auto-expande cuando `pathname.startsWith("/dashboard/settings") || pathname === "/dashboard/katas"`
- **MobileNav**: muestra 6 ítems simplificados + botón ← cuando no es `/dashboard`

---

## APIs
```
POST /api/upload                      → Sube imagen o video a Cloudinary. FormData: file + type(image|video).
                                        Solo admin/sysadmin. Devuelve { url, publicId }.
GET/POST /api/roles                   → Lista roles del dojo (system + custom) con sus permisos. POST crea rol personalizado.
PUT/DELETE /api/roles/[id]            → Actualiza permisos / elimina rol personalizado (falla si hay usuarios con ese rol)
POST /api/roles/system                → Crea o actualiza override de rol de sistema (admin/user) con permisos custom
GET /api/roles/current                → Devuelve { permissions: NavKey[] } del usuario actual. Usado por usePermissions hook.
GET/POST /api/users                   → Lista usuarios. POST crea usuario con photo opcional.
PUT/DELETE /api/users/[id]            → Edita usuario (name,email,role,photo,active,password). DELETE falla si es el último sysadmin.
GET/POST /api/belt-videos             → CRUD videos por cinta. GET acepta ?beltColor=
PUT/DELETE /api/belt-videos/[id]      → Actualiza/elimina video (también borra de Cloudinary en DELETE)
GET /api/portal/belt-videos           → Solo para role=student. Devuelve { videos, earnedBelts }
                                        filtrado por cintas obtenidas en BeltHistory del alumno
POST /api/seed
GET/PUT  /api/dojo                    → Config del dojo. GET excluye logo/loginBgImage por defecto.
                                        Usar ?logo=1 para incluirlos. PUT invalida caché dojo.
GET/POST /api/dojos                   → Gestión dojos (sysadmin)
PUT/DELETE /api/dojos/[id]
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
GET/POST /api/attendance              → GET: auth requerida. POST: público (scanner QR)
PUT/DELETE /api/attendance/[id]
GET /api/scan?id=studentId&scheduleId → Público. Soporta studentCode numérico. 
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

Responde `429 Too Many Requests` con `Retry-After`.

### Cifrado
- Contraseña SMTP: AES-256-CBC con IV aleatorio — `src/lib/crypto.ts`
- Clave en `ENCRYPTION_KEY` (32 bytes base64 en `.env.local`)
- Nunca retornar la contraseña al cliente (se devuelve `"••••••••"`)
- Al re-guardar sin cambiar contraseña, enviar `"••••••••"` → API detecta y preserva el valor cifrado

---

## Reglas críticas de desarrollo

### Datos y seguridad
1. **Nunca omitir `dojoId`** en queries de Student, Kata, Payment, BeltHistory, Schedule, KataCompetition
2. `dojoId` siempre desde `session.user.dojoId`, nunca del cliente
3. Nuevo modelo de dojo → `dojoId String @map("dojo_id")` + relación con `Dojo`
4. `sysadmin` gestiona dojos pero no opera dentro de ellos
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

### Usuarios — gestión
28. **`User.photo`**: URL Cloudinary (o `null`). Se muestra en la tabla de usuarios y en el avatar del Sidebar/MobileNav via `session.user.image`.
29. **Cambiar contraseña via admin**: `PUT /api/users/[id]` con `{ password, mustChangePassword: true }` → fuerza cambio en próximo login.
30. **Eliminar usuario**: bloqueado si es el último sysadmin. Verificar con `count({ where: { role: "sysadmin" } })`.

### Sistema de Roles y Permisos (RBAC)
31. **`DojoRolePermission`**: tabla de permisos por dojo. `roleName` coincide con `User.role`. Roles del sistema (admin/user) tienen `isSystem=true`.
32. **Roles de sistema**: `sysadmin` (hardcoded total), `admin` (todos los keys del dojo), `user` (básico personalizable).
33. **Roles personalizados**: creados por admin, heredan permisos de `user` al crearse. No pueden usar nombres reservados (sysadmin/admin/user/student).
34. **`permissions` JSON**: array de `NavKey[]` — claves definidas en `src/lib/permissions.ts`. Solo controlan visibilidad de navegación, no acceso a APIs.
35. **`usePermissions` hook**: llama `GET /api/roles/current` y retorna `Set<NavKey>`. Usado por Sidebar y MobileNav para filtrar ítems visibles.
36. **Override de sistema**: la primera vez que admin guarda permisos para un rol de sistema, se crea el registro vía `POST /api/roles/system` (upsert). Actualizaciones posteriores via `PUT /api/roles/[id]`.
37. **Asignar rol personalizado**: `User.role` es un string libre — al crear/editar usuario se listan los roles disponibles del dojo (incluyendo custom).

### Cloudinary — imágenes y videos
38. **`POST /api/upload`**: solo admin/sysadmin. `FormData` con `file` + `type` (image|video). Devuelve `{ url, publicId }`.
29. **Fotos de alumnos**: URL Cloudinary guardada en `Student.photo`. Backward compat: si empieza con `data:` es base64 antigua — se renderiza igual con `<img>`.
30. **Videos**: modelo `BeltVideo` con `videoUrl` y `publicId`. El `publicId` se usa para borrar en Cloudinary al DELETE.
31. **`token.picture`**: se setea en auth.ts jwt() con `student.photo` → mapea a `session.user.image` automáticamente.
32. **Acceso a videos del portal**: `GET /api/portal/belt-videos` filtra por `beltHistory` del alumno — solo cintas ya obtenidas.

### Rendimiento
19. **Nunca fetch en `useEffect` para carga inicial** si la página puede ser Server Component
20. **`useDojo`**: deps `[userId, role, overrideId]` (strings) — nunca el objeto `session`
21. **`GET /api/dojo`**: excluye `logo` y `loginBgImage` por defecto — `?logo=1` solo en Settings
22. **`GET /api/katas?active=1`**: usa `unstable_cache` 10 min con tag `katas-{dojoId}`
23. **Invalidar caché**: `revalidateTag(CACHE_TAGS.katas(dojoId))` en POST/PUT/DELETE katas
24. **Invalidar caché dojo**: `revalidateTag(CACHE_TAGS.dojo(dojoId))` en PUT /api/dojo
25. Toda ruta nueva del dashboard → `loading.tsx` obligatorio con skeleton
26. Listados puros → Server Components. CRUDs con modales → Client Components
27. `overflow-x-auto` en todos los wrappers de tabla — `overflow-x-hidden` en layout main

---

## Índices en PostgreSQL (aplicados)

```
students: (dojoId, active), (dojoId, lastName, firstName), (dojoId, fullName), (dojoId, active, fullName)
payments: (studentId), (studentId, status, dueDate), (status, dueDate), (reminderSent, status, dueDate)
belt_history: (studentId, changeDate)
attendances: (studentId, markedAt), (scheduleId, markedAt)
katas: (dojoId), (beltColor), unique(name, dojoId)
kata_competitions: (studentId), (date)
```

---

## Recordatorios y recibos de pago

### Recordatorio individual
1. Botón "Recordatorio" en cada fila (siempre visible) → modal de confirmación
2. Modal muestra: alumno, acudiente(s) con correo, monto, vencimiento
3. Si no hay correos: aviso rojo, botón "Enviar" deshabilitado
4. Confirmar → `POST /api/payments/remind { paymentId }`

### Generación mensual (sin N+1)
- `POST /api/payments/generate` → 3 queries totales usando `createMany + skipDuplicates`
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

### Catálogo (`/dashboard/katas`) — solo lectura, sub-menú Configuración
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
| `dojos` | `email`, `logo`(base64), `login_bg_image`(base64), params recordatorios |
| `users` | `role`, `dojoId`, `mustChangePassword` |
| `students` | `full_name`, `studentCode`(≥1000), `cedula`, `fepaka_id`, `ryo_bukai_id`, `condition`, `blood_type`, `insurance_number`, `photo`(base64), `active` |
| `inscriptions` | `annualAmount`, `monthlyAmount`, `discountAmount`, `discountNote` |
| `payments` | `type`(monthly/annual), `status`(pending/paid/late), `reminderSent` |
| `belt_history` | `beltColor`, `changeDate`, `kataId`, `isRanking`, `notes` |
| `katas` | `name`, `beltColor`, `order`, `description`, `dojoId` — unique(name,dojoId) |
| `kata_competitions` | `studentId`, `kataId`, `date`, `tournament`, `result`, `notes` |
| `schedules` | `days`=JSON, `startTime`, `endTime`, `dojoId` |
| `attendances` | `type`(entry/exit), `corrected`, `correctedBy`; sin `dojoId` directo |
| `student_schedules` | join Student ↔ Schedule |
| `audit_logs` | `action`, `userId`, `dojoId`, `ip`, `userAgent`, `details` |
| `email_settings` | `host`, `port`, `user`, `password`(**cifrado AES-256**), `secure`, `fromName` |
| `belt_videos` | `dojoId`, `beltColor`, `title`, `description`, `videoUrl`, `publicId`(Cloudinary), `order`, `active` |
| `dojo_role_permissions` | `dojoId`, `roleName`, `roleLabel`, `roleColor`, `isSystem`, `permissions`(Json→NavKey[]) |

---

## Estructura de archivos clave
```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx              ← min-w-0 overflow-x-hidden en main
│   │   ├── page.tsx                ← Server Component; DashboardMobileCards al inicio
│   │   ├── students/
│   │   │   ├── page.tsx            ← Server Component (datos iniciales activos)
│   │   │   ├── StudentsClient.tsx  ← filtros: búsqueda, activo/inactivo, cinta (client-side)
│   │   │   └── [id]/
│   │   │       ├── page.tsx        ← Client Component (perfil + activar/desactivar)
│   │   │       └── edit/page.tsx   ← Server Component (fullName precargado)
│   │   ├── payments/page.tsx       ← vista mobile en tarjetas + lg tabla
│   │   ├── settings/
│   │   │   ├── page.tsx            ← logo, email dojo, bg login, params
│   │   │   ├── katas/page.tsx      ← CRUD katas con tipo dropdown
│   │   │   └── email/page.tsx      ← SMTP: host, port, user, pass, security(radio), test
│   │   ├── katas/page.tsx          ← Solo lectura con overflow-x-auto
│   │   └── [ruta]/loading.tsx      ← Skeleton en todas las rutas
│   ├── portal/
│   │   ├── layout.tsx              ← PortalNav
│   │   ├── page.tsx                ← Perfil del alumno
│   │   ├── change-password/
│   │   ├── payments/               ← Historial de pagos propios
│   │   ├── attendance/             ← Historial de asistencia propia
│   │   └── schedules/              ← Horarios asignados
│   ├── scanner/page.tsx            ← html5-qrcode, entrada manual, overlays resultado
│   └── api/
│       ├── dojo/route.ts           ← revalidateTag(dojo) en PUT
│       ├── katas/
│       │   ├── route.ts            ← ?active=1 usa getCachedKatas(); sin param: Prisma directo
│       │   └── [id]/route.ts       ← revalidateTag(katas) en PUT/DELETE
│       ├── payments/
│       │   ├── route.ts
│       │   ├── generate/route.ts   ← createMany (sin N+1)
│       │   ├── remind/route.ts
│       │   └── receipt/route.ts
│       ├── admin/email-settings/
│       │   ├── route.ts            ← cifra contraseña con encrypt()
│       │   └── test/route.ts       ← descifra con decrypt() para test
│       └── public/login-bg/route.ts ← loginBgImage sin auth
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             ← expandible; incluye /dashboard/katas en settings
│   │   └── MobileNav.tsx           ← ← botón back, 6 ítems simplificados, settingsSubItems
│   ├── dashboard/
│   │   └── DashboardMobileCards.tsx ← tarjetas mobile (block lg:hidden), Alumnos → link
│   └── students/
│       └── StudentForm.tsx         ← fullName único, condition, bloodType, insuranceNumber
└── lib/
    ├── prisma.ts
    ├── auth.ts                     ← incluye token.picture = student.photo para avatar en JWT
    ├── email.ts                    ← createTransporter() descifra password; fromAddress() usa dojo.email
    ├── crypto.ts                   ← encrypt/decrypt AES-256-CBC con ENCRYPTION_KEY
    ├── cloudinary.ts               ← uploadBuffer(), deleteResource() — usa CLOUDINARY_* env vars
    ├── permissions.ts              ← NAV_KEYS, DEFAULT_PERMISSIONS, ALL_DOJO_KEYS, resolvePermissions()
    ├── queries.ts                  ← getCachedKatas(), getCachedDojoMeta(), CACHE_TAGS
    ├── audit.ts
    ├── utils.ts                    ← BELT_COLORS (16 cintas)
    ├── hooks/useDojo.ts            ← deps: [userId, role] strings
    └── hooks/usePermissions.ts     ← fetch /api/roles/current → Set<NavKey>; default fallback inmediato
```
