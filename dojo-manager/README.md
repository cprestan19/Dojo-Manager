# 🥋 DojoManager — Sistema de Administración de Karate

```
Desarrollador  : Ing. Cristhian Paul Prestán
Versión        : 1.0.0
Base de datos  : PostgreSQL 14+
Stack          : Next.js 15 · TypeScript · PostgreSQL · Prisma · NextAuth
© 2025-2026    Todos los derechos reservados
```

---

## 🚀 Instalación

### Prerequisitos
- Node.js 18+
- PostgreSQL 14+ (local o en la nube)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Crear la base de datos en PostgreSQL
```sql
-- En psql o pgAdmin:
CREATE DATABASE dojomanager;
```

### 3. Configurar .env.local
```bash
cp .env.example .env.local   # si tienes el ejemplo
# o editar directamente .env.local
```

```env
# Local
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/dojomanager"

# Nube (Neon / Railway / Supabase)
# DATABASE_URL="postgresql://user:pass@host:5432/dojomanager?sslmode=require"

NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="tu-correo@gmail.com"
EMAIL_PASS="xxxx xxxx xxxx xxxx"
EMAIL_FROM="DojoManager <tu-correo@gmail.com>"
```

### 4. Sincronizar schema con PostgreSQL
```bash
npx prisma db push
# o con migraciones versionadas:
npx prisma migrate dev --name init
```

### 5. Generar cliente Prisma
```bash
npx prisma generate
```

### 6. Iniciar el servidor
```bash
npm run dev
```

### 7. Cargar datos iniciales (solo 1 vez)
```bash
curl -X POST http://localhost:3000/api/seed
```

---

## 🔐 Credenciales iniciales
| Email                    | Contraseña | Rol      |
|--------------------------|------------|----------|
| admin@dojomanager.com    | Admin123!  | sysadmin |

⚠️ Cambia la contraseña en Usuarios después del primer login.

---

## 👤 Roles
| Rol       | Permisos                                      |
|-----------|-----------------------------------------------|
| sysadmin  | Todo + configuración + gestión de usuarios    |
| admin     | Alumnos, pagos, katas, reportes, usuarios     |
| user      | Solo lectura                                  |

---

## 🔧 Comandos
```bash
npm run dev            # Desarrollo
npm run build          # Build de producción
npm run db:studio      # GUI de base de datos (Prisma Studio)
npm run db:push        # Sincronizar schema
npm run db:migrate     # Nueva migración versionada
npm run db:generate    # Regenerar cliente Prisma
```

---

## 🌐 Deploy en producción

### Vercel + Neon PostgreSQL (recomendado)
1. Crear DB en https://neon.tech (gratis)
2. Copiar `DATABASE_URL` al panel de Vercel → Environment Variables
3. Agregar las demás variables de `.env.local`
4. `vercel --prod`

### Railway
```bash
railway login && railway init
railway add postgresql
railway up
```

---

*© 2025-2026 Ing. Cristhian Paul Prestán — DojoManager — Todos los derechos reservados*
