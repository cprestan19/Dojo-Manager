/**
 * Script de migración de datos: PostgreSQL local → Supabase
 * Uso: node scripts/migrate-to-supabase.mjs
 *
 * Variables requeridas:
 *   SOURCE_URL  = URL de la base de datos local (origen)
 *   TARGET_URL  = URL de Supabase (destino)
 *
 * Ejemplo:
 *   SOURCE_URL="postgresql://postgres:pass@localhost:5432/dojomanager" \
 *   TARGET_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres" \
 *   node scripts/migrate-to-supabase.mjs
 */

import pg from "pg";

const SOURCE_URL = process.env.SOURCE_URL;
const TARGET_URL = process.env.TARGET_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("❌  Define SOURCE_URL y TARGET_URL como variables de entorno.");
  process.exit(1);
}

const source = new pg.Pool({ connectionString: SOURCE_URL });
const target = new pg.Pool({
  connectionString: TARGET_URL,
  ssl: { rejectUnauthorized: false },
});

async function copyTable(tableName, orderBy = "created_at") {
  const res = await source.query(`SELECT * FROM "${tableName}" ORDER BY "${orderBy}" ASC`);
  if (res.rows.length === 0) {
    console.log(`   ⏭  ${tableName}: sin datos`);
    return 0;
  }

  const columns = Object.keys(res.rows[0]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const colNames     = columns.map(c => `"${c}"`).join(", ");
  const upsertSQL    = `
    INSERT INTO "${tableName}" (${colNames})
    VALUES (${placeholders})
    ON CONFLICT DO NOTHING
  `;

  let inserted = 0;
  for (const row of res.rows) {
    try {
      await target.query(upsertSQL, columns.map(c => row[c]));
      inserted++;
    } catch (err) {
      console.warn(`   ⚠  ${tableName} fila ${row.id ?? "?"}: ${err.message}`);
    }
  }
  console.log(`   ✓  ${tableName}: ${inserted}/${res.rows.length} registros`);
  return inserted;
}

async function main() {
  console.log("🚀  Iniciando migración local → Supabase\n");

  await target.query("SET session_replication_role = 'replica'");

  const tables = [
    { name: "dojos",            order: "created_at" },
    { name: "email_settings",   order: "updated_at" },
    { name: "users",            order: "created_at" },
    { name: "students",         order: "created_at" },
    { name: "inscriptions",     order: "created_at" },
    { name: "katas",            order: "created_at" },
    { name: "schedules",        order: "created_at" },
    { name: "payments",         order: "created_at" },
    { name: "belt_history",     order: "created_at" },
    { name: "kata_competitions", order: "created_at" },
    { name: "attendances",      order: "created_at" },
    { name: "student_schedules", order: "assigned_at" },
    { name: "audit_logs",       order: "created_at"  },
  ];

  let total = 0;
  for (const t of tables) {
    total += await copyTable(t.name, t.order);
  }

  await target.query("SET session_replication_role = 'origin'");

  console.log(`\n✅  Migración completada — ${total} registros totales migrados`);
}

main()
  .catch(err => { console.error("❌ Error:", err.message); process.exit(1); })
  .finally(() => { source.end(); target.end(); });
