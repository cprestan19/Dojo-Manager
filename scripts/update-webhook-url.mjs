/**
 * update-webhook-url.mjs
 * Actualiza la URL del webhook de PayPal Sandbox con la URL de ngrok.
 *
 * Uso:
 *   node scripts/update-webhook-url.mjs https://xxxx.ngrok.io
 *
 * También puede detectar ngrok automáticamente:
 *   node scripts/update-webhook-url.mjs --auto
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

function readEnv() {
  const lines = readFileSync(resolve(__dir, "../.env.local"), "utf-8").split("\n");
  const env   = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env        = readEnv();
const PAYPAL_ID  = env.PAYPAL_CLIENT_ID;
const PAYPAL_SEC = env.PAYPAL_CLIENT_SECRET;
const WEBHOOK_ID = env.PAYPAL_WEBHOOK_ID;
const BASE       = "https://api-m.sandbox.paypal.com";

async function getToken() {
  const creds = Buffer.from(`${PAYPAL_ID}:${PAYPAL_SEC}`).toString("base64");
  const { access_token } = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:   "grant_type=client_credentials",
  }).then(r => r.json());
  return access_token;
}

async function detectNgrok() {
  try {
    const tunnels = await fetch("http://localhost:4040/api/tunnels").then(r => r.json());
    const https   = tunnels.tunnels?.find(t => t.proto === "https");
    return https?.public_url ?? null;
  } catch {
    return null;
  }
}

async function run() {
  let ngrokUrl = process.argv[2];

  if (ngrokUrl === "--auto" || !ngrokUrl) {
    console.log("🔍  Detectando ngrok en localhost:4040...");
    ngrokUrl = await detectNgrok();
    if (!ngrokUrl) {
      console.error("❌  No se detectó ngrok. Inicia ngrok primero: ngrok http 3000");
      console.error("    O pasa la URL manualmente: node scripts/update-webhook-url.mjs https://xxxx.ngrok.io");
      process.exit(1);
    }
    console.log("✅  ngrok detectado:", ngrokUrl);
  }

  // Normalizar URL (quitar trailing slash)
  ngrokUrl = ngrokUrl.replace(/\/$/, "");
  const webhookUrl = `${ngrokUrl}/api/webhooks/paypal`;

  if (!WEBHOOK_ID) {
    console.error("❌  PAYPAL_WEBHOOK_ID no está configurado en .env.local");
    process.exit(1);
  }

  console.log(`\n📡  Actualizando webhook ${WEBHOOK_ID}`);
  console.log(`    Nueva URL: ${webhookUrl}\n`);

  const token = await getToken();

  const res = await fetch(`${BASE}/v1/notifications/webhooks/${WEBHOOK_ID}`, {
    method:  "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      { op: "replace", path: "/url", value: webhookUrl },
    ]),
  });

  const data = await res.json();

  if (data.id) {
    console.log("✅  Webhook actualizado correctamente");
    console.log("    ID:  ", data.id);
    console.log("    URL: ", data.url);
    console.log("\n🎯  Listo para recibir eventos de PayPal en local.");
    console.log("    Ahora ve a tu dojo → /dashboard/billing y prueba el pago.\n");
  } else {
    console.error("❌  Error actualizando webhook:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

run().catch(err => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
