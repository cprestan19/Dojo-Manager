# DojoMasterOnline — Reglas de arquitectura

## Stack
- Next.js 15, TypeScript, Tailwind CSS 3
- Prisma 7, PostgreSQL
- NextAuth v4

## Reglas CRÍTICAS — nunca violar
- NUNCA modificar archivos existentes salvo los indicados explícitamente
- NUNCA modificar NextAuth ni nada en src/app/api/auth/
- NUNCA modificar APIs, queries o endpoints existentes
- Todo código nuevo va en archivos nuevos
- Usar getEffectiveDojoId() en todas las APIs
- Usar logAudit() para operaciones sensibles
- npx prisma db push + npx prisma generate tras cambios de schema
- TypeScript estricto, sin any
- Try/catch en todas las APIs

## Lo único permitido en archivos existentes
- Agregar modelos nuevos al schema.prisma
- Agregar el campo "subscription Subscription?" al modelo Dojo
- Agregar <BillingBanner /> en el dashboard layout
- Agregar link de Facturación en el sidebar
- Agregar withReadOnlyGuard en los handlers de students, payments, belts y tournaments

## ⚠️ REGLA DE DESPLIEGUE — Leer antes de hacer push

**NUNCA ejecutar `git push` sin autorización explícita del usuario.**

Vercel está conectado a la rama `main` y despliega automáticamente al detectar cualquier push.
El usuario necesita probar los cambios localmente antes de enviarlos a producción.

**Flujo obligatorio:**
1. Hacer los cambios y commits localmente
2. Preguntar al usuario: *"¿Autorizo el push a GitHub? Eso activará el deploy en Vercel."*
3. Esperar confirmación explícita antes de ejecutar `git push`

Esto aplica para cualquier push, incluyendo commits vacíos de "trigger deploy".
