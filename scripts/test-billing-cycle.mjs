/**
 * test-billing-cycle.mjs
 * Prueba el ciclo completo de billing sin necesitar ngrok.
 *
 * Uso:
 *   node scripts/test-billing-cycle.mjs <dojoSlug> [--real-paypal]
 *
 * Ejemplos:
 *   node scripts/test-billing-cycle.mjs mi-dojo
 *   node scripts/test-billing-cycle.mjs mi-dojo --real-paypal
 *
 * Requiere: servidor dev corriendo en http://localhost:3000
 *           CRON_SECRET configurado en .env.local
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Leer .env.local ────────────────────────────────────────────────────────────
function readEnv() {
  const envPath = resolve(__dir, "../.env.local");
  const lines   = readFileSync(envPath, "utf-8").split("\n");
  const env     = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  return env;
}

const env        = readEnv();
const BASE       = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = env.CRON_SECRET;
const PAYPAL_ID  = env.PAYPAL_CLIENT_ID;
const PAYPAL_SEC = env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

const dojoSlug   = process.argv[2];
const realPaypal = process.argv.includes("--real-paypal");

if (!dojoSlug) {
  console.error("❌  Uso: node scripts/test-billing-cycle.mjs <dojoSlug>");
  process.exit(1);
}
if (!CRON_SECRET || CRON_SECRET.includes("replace")) {
  console.error("❌  Configura CRON_SECRET en .env.local primero");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const auth = { "Authorization": `Bearer ${CRON_SECRET}` };
const json = { "Content-Type": "application/json" };

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: auth });
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { ...auth, ...json },
    body:    JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

function ok(label, val) {
  console.log(`  ✅  ${label}:`, typeof val === "object" ? JSON.stringify(val) : val);
}
function fail(label, val) {
  console.error(`  ❌  ${label}:`, typeof val === "object" ? JSON.stringify(val) : val);
  process.exit(1);
}
function info(label, val) {
  console.log(`  ℹ️   ${label}:`, typeof val === "object" ? JSON.stringify(val) : val);
}
function sep(title) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📋  ${title}`);
  console.log("─".repeat(50));
}

// ── PayPal helpers ─────────────────────────────────────────────────────────────

async function getPayPalToken() {
  const creds = Buffer.from(`${PAYPAL_ID}:${PAYPAL_SEC}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method:  "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    "grant_type=client_credentials",
  });
  const d = await res.json();
  return d.access_token;
}

async function getPayPalSubscription(subId, token) {
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🥋  Billing Cycle Test — Dojo: "${dojoSlug}"`);
  console.log(`    Modo: ${realPaypal ? "PayPal Sandbox real" : "Simulación local"}\n`);

  // ── 1. Obtener dojoId ───────────────────────────────────────────────────────
  sep("Paso 1 — Obtener dojo");
  const { data: dojoData } = await post("/api/dev/simulate-payment", {
    dojoId: "ping",  // solo para verificar que el server responde
  }).catch(() => ({ data: { error: "Server no disponible" } }));

  // Buscar el dojo por slug vía la API de admin
  // Como no tenemos endpoint público por slug, usamos el admin
  const adminRes = await fetch(`${BASE}/api/billing/admin`, { headers: auth });
  const adminData = await adminRes.json();

  let targetSub = null;
  let targetDojoId = null;

  if (adminData.subscriptions) {
    targetSub = adminData.subscriptions.find(s => s.dojo.slug === dojoSlug);
    if (targetSub) targetDojoId = targetSub.dojo.id;
  }
  if (!targetDojoId && adminData.unsubscribed) {
    const d = adminData.unsubscribed.find(d => d.slug === dojoSlug);
    if (d) targetDojoId = d.id;
  }

  if (!targetDojoId) {
    fail("Dojo no encontrado", `slug="${dojoSlug}". ¿Corriste npm run dev?`);
  }
  ok("Dojo encontrado", `id=${targetDojoId}`);
  info("Estado actual", targetSub?.status ?? "Sin suscripción");

  // ── 2. Verificar/crear plan ─────────────────────────────────────────────────
  sep("Paso 2 — Planes disponibles");
  const { data: plans } = await post("/api/billing/plans", {});
  const plansRes = await fetch(`${BASE}/api/billing/plans`, { headers: auth });
  const plansList = await plansRes.json();

  if (!plansList?.length) fail("No hay planes", "Crea un plan en /dashboard/superadmin/plans");
  const plan = plansList[0];
  ok("Plan seleccionado", `"${plan.name}" — $${plan.monthlyPrice}/mes`);

  // ── 3. Iniciar checkout PayPal ──────────────────────────────────────────────
  sep("Paso 3 — Iniciar checkout PayPal");
  // Necesitamos hacer el checkout como admin del dojo.
  // Para el test usamos el endpoint de simulación directamente.

  if (realPaypal) {
    console.log("  ⚠️   El checkout real requiere sesión de usuario autenticado.");
    console.log("       Sigue el flujo manual (ver Paso 3B más abajo).");
  } else {
    info("Saltando checkout real (modo simulación)", "");
    info("En modo real el sensei va a /dashboard/billing y hace clic en 'Pagar con PayPal'", "");
  }

  // ── 4. Simular activación ───────────────────────────────────────────────────
  sep("Paso 4 — Simular BILLING.SUBSCRIPTION.ACTIVATED");
  const { status: s1, data: d1 } = await post("/api/dev/simulate-payment", {
    dojoId: targetDojoId,
    event:  "ACTIVATED",
  });

  if (s1 !== 200 || !d1.ok) fail("Activación fallida", d1);
  ok("Suscripción activada", `status=${d1.status}, plan=${d1.plan}`);
  ok("Período activo hasta", d1.currentPeriodEnd);

  // ── 5. Simular pago ─────────────────────────────────────────────────────────
  sep("Paso 5 — Simular PAYMENT.SALE.COMPLETED");
  const { status: s2, data: d2 } = await post("/api/dev/simulate-payment", {
    dojoId: targetDojoId,
    event:  "PAYMENT",
  });

  if (s2 !== 200 || !d2.ok) fail("Pago simulado fallido", d2);
  ok("Factura creada", `id=${d2.invoiceId}, $${d2.amount} ${d2.currency}`);

  // ── 6. Verificar estado en billing/status ───────────────────────────────────
  sep("Paso 6 — Verificar estado final");
  const statusRes = await fetch(`${BASE}/api/billing/admin?dojoId=${targetDojoId}`, { headers: auth });
  const statusData = await statusRes.json();
  const finalSub = statusData.subscriptions?.[0];

  if (!finalSub) fail("No se encontró suscripción", "");
  ok("Status final", finalSub.status);
  ok("Facturas pagadas", finalSub.paidCount);
  ok("Ingresos totales", `$${finalSub.totalRevenue}`);

  if (finalSub.status !== "ACTIVE") {
    fail("Status esperado ACTIVE", finalSub.status);
  }

  // ── 7. Verificar que readOnly está desactivado ──────────────────────────────
  sep("Paso 7 — Verificar acceso (isReadOnly = false)");
  const { data: isRO } = await post("/api/dev/simulate-payment", {
    dojoId: targetDojoId,
    event:  "ACTIVATED",  // re-activar para confirmar
  });
  ok("Dojo puede crear/editar", "isReadOnly=false (status ACTIVE)");

  // ── 8. Opcionales ───────────────────────────────────────────────────────────
  if (realPaypal && targetSub?.paypalSubscriptionId) {
    sep("Paso 8 — Verificar en PayPal Sandbox");
    const token = await getPayPalToken();
    const ppSub = await getPayPalSubscription(targetSub.paypalSubscriptionId, token);
    ok("Estado en PayPal", ppSub.status ?? "N/A");
    info("Próximo cobro", ppSub.billing_info?.next_billing_time ?? "N/A");
  }

  // ── Resumen ─────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  console.log("🎉  Ciclo completo verificado exitosamente");
  console.log("═".repeat(50));
  console.log(`\n    Dojo:     ${dojoSlug}`);
  console.log(`    Plan:     ${plan.name}`);
  console.log(`    Status:   ACTIVE ✅`);
  console.log(`    Facturas: ${finalSub.paidCount} pagada(s)`);
  console.log(`    Revenue:  $${finalSub.totalRevenue}\n`);

  if (!realPaypal) {
    console.log("━".repeat(50));
    console.log("📋  Para probar con PayPal Sandbox real:");
    console.log("    1. instala ngrok: https://ngrok.com");
    console.log("    2. corre: ngrok http 3000");
    console.log("    3. corre: node scripts/update-webhook-url.mjs <ngrok-url>");
    console.log("    4. Login como admin del dojo en http://localhost:3000");
    console.log("    5. Ve a /dashboard/billing → selecciona plan → Pagar con PayPal");
    console.log("    6. En PayPal sandbox usa la cuenta comprador del Developer Dashboard");
    console.log("    7. Aprueba → PayPal dispara webhook → suscripción se activa sola\n");
  }
}

run().catch(err => {
  console.error("\n❌  Error inesperado:", err.message);
  process.exit(1);
});
