import { createHmac, timingSafeEqual, createHash } from "crypto";

// ── Ambiente y credenciales ───────────────────────────────────────────────────
// A diferencia de PayPal/MercadoPago (un solo par de credenciales + flag de modo),
// aquí se exigen nombres de variable separados por ambiente para que nunca se
// mezclen CCLW/accessToken de sandbox con los de producción.

export type PagueloFacilMode = "sandbox" | "production";

export function getMode(): PagueloFacilMode {
  const mode = process.env.PAGUELOFACIL_MODE ?? "sandbox";
  return mode === "production" ? "production" : "sandbox";
}

function assertModeMatchesRuntime(mode: PagueloFacilMode): void {
  if (mode === "production" && process.env.NODE_ENV !== "production") {
    throw new Error(
      "PAGUELOFACIL_MODE=production no está permitido fuera de NODE_ENV=production " +
      "(evita cobros reales accidentales desde un entorno de desarrollo).",
    );
  }
}

interface PagueloFacilCredentials {
  cclw: string;
  accessToken: string;
}

function getCredentials(): PagueloFacilCredentials {
  const mode = getMode();
  assertModeMatchesRuntime(mode);

  const cclw = mode === "production"
    ? process.env.PAGUELOFACIL_PROD_CCLW
    : process.env.PAGUELOFACIL_SANDBOX_CCLW;
  const accessToken = mode === "production"
    ? process.env.PAGUELOFACIL_PROD_ACCESS_TOKEN
    : process.env.PAGUELOFACIL_SANDBOX_ACCESS_TOKEN;

  if (!cclw || !accessToken) {
    throw new Error(
      `Credenciales de PagueloFacil no configuradas para modo "${mode}" ` +
      `(faltan PAGUELOFACIL_${mode === "production" ? "PROD" : "SANDBOX"}_CCLW / _ACCESS_TOKEN).`,
    );
  }
  return { cclw, accessToken };
}

// Expone el código de comercio activo únicamente para fines de auditoría/registro
// (no es secreto como el accessToken — es el identificador "código web" del comercio).
export function currentCclw(): string {
  return getCredentials().cclw;
}

function linkBaseUrl(mode: PagueloFacilMode): string {
  return mode === "production"
    ? "https://secure.paguelofacil.com"
    : "https://sandbox.paguelofacil.com";
}

function apiBaseUrl(mode: PagueloFacilMode): string {
  return mode === "production"
    ? "https://api.pfserver.net"
    : "https://api-sand.pfserver.net";
}

const MIN_AMOUNT_USD = 1.0;

// ── Generación del Enlace de Pago ─────────────────────────────────────────────

export interface GeneratePaymentLinkParams {
  amount:            number;   // USD — mínimo 1.00 (restricción del proveedor)
  description:       string;   // máx 150 caracteres
  returnUrl:         string;   // URL en texto plano — se codifica a hex antes de enviar
  expiresInSeconds:  number;
}

export interface GeneratePaymentLinkResult {
  code: string;   // "LK-..." — identificador único del link
  url:  string;   // URL de checkout para redirigir al usuario
}

export async function generatePaymentLink(
  params: GeneratePaymentLinkParams,
): Promise<GeneratePaymentLinkResult> {
  if (params.amount < MIN_AMOUNT_USD) {
    throw new Error(
      `Monto ${params.amount.toFixed(2)} por debajo del mínimo de PagueloFacil (US$ ${MIN_AMOUNT_USD.toFixed(2)}).`,
    );
  }
  if (params.description.length > 150) {
    throw new Error("La descripción del cobro excede 150 caracteres (límite de PagueloFacil).");
  }

  const mode  = getMode();
  const { cclw } = getCredentials();

  // RETURN_URL debe enviarse codificado en hexadecimal (formato exigido por LinkDeamon.cfm)
  const returnUrlHex = Buffer.from(params.returnUrl, "utf8").toString("hex");

  const body = new URLSearchParams({
    CCLW:        cclw,
    CMTN:        params.amount.toFixed(2),
    CDSC:        params.description,
    RETURN_URL:  returnUrlHex,
    EXPIRES_IN:  String(params.expiresInSeconds),
  });

  const res = await fetch(`${linkBaseUrl(mode)}/LinkDeamon.cfm`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`PagueloFacil LinkDeamon error (${res.status}): ${errText}`);
  }

  const json = await res.json() as {
    success?: boolean;
    headerStatus?: { code: number; description: string };
    data?: { url?: string; code?: string };
  };

  if (!json.success || !json.data?.code || !json.data?.url) {
    throw new Error(
      `PagueloFacil no devolvió un link válido: ${json.headerStatus?.description ?? "respuesta inesperada"}`,
    );
  }

  return { code: json.data.code, url: json.data.url };
}

// ── Re-consulta del estado real de una transacción (fuente de verdad) ────────
// El webhook opcional de PagueloFacil no viene firmado y el RETURN_URL lo arma
// el navegador del cliente — ninguno de los dos es confiable por sí solo.
// Esta consulta contra MerchantTransactions con el accessToken del comercio es
// la única confirmación server-to-server verificable disponible.

export interface PagueloFacilTransactionRecord {
  codOper: string;
  status:  string | number;   // validado contra sandbox real: status numérico 1 = aprobada (Fase 5 QA)
  totalPay?: number;          // extraído de amount/authAmount — ver comentario en getTransactionByCodOper
  raw: Record<string, unknown>;
}

export async function getTransactionByCodOper(
  codOper: string,
): Promise<PagueloFacilTransactionRecord | null> {
  const mode = getMode();
  const { accessToken } = getCredentials();

  const url = `${apiBaseUrl(mode)}/PFManagementServices/api/v1/MerchantTransactions` +
              `?filter=codOper::${encodeURIComponent(codOper)}`;

  const res = await fetch(url, {
    method:  "GET",
    headers: { Authorization: accessToken },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`PagueloFacil MerchantTransactions error (${res.status}): ${errText}`);
  }

  const json = await res.json() as { data?: Record<string, unknown>[] | Record<string, unknown> };
  const rows = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []);
  const row  = rows[0];
  if (!row) return null;

  // Campos devueltos observados en la documentación pública vienen en distintas
  // convenciones (camelCase / PascalCase) según el canal — se leen ambas formas.
  // totalPay/TotalPay/TotalPagado nunca aparecieron en una respuesta real de
  // MerchantTransactions (validado en Fase 5 QA contra sandbox real) — el monto
  // realmente cobrado viene en "amount" (o "authAmount", como string). Se
  // mantienen los nombres originales primero por si producción sí los usa.
  const status   = (row.status ?? row.Status ?? row.Estado) as string | number | undefined;
  const totalPay = (row.totalPay ?? row.TotalPay ?? row.TotalPagado
                  ?? row.amount ?? row.Amount ?? row.authAmount ?? row.AuthAmount) as number | string | undefined;

  return {
    codOper,
    status: status ?? "",
    totalPay: totalPay != null ? Number(totalPay) : undefined,
    raw: row,
  };
}

// ── attemptId determinístico — idempotencia real ante reintentos ─────────────
// Un cuid()/uuid() aleatorio no protegería nada: un reintento del cron generaría
// un id distinto cada vez. Se deriva de partes estables del ciclo de cobro, y se
// calcula ANTES de llamar a PagueloFacil (el linkCode que ellos asignan no se
// conoce todavía en ese momento, así que no puede ser la base de la firma).

export function buildAttemptId(parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32);
}

// ── Token firmado del RETURN_URL — atado al intento (attemptId), no al linkCode
// El linkCode lo asigna PagueloFacil DESPUÉS de esta llamada, así que no puede
// ser parte de la firma que viaja en el propio RETURN_URL de esa misma llamada.
// attemptId sí se conoce de antemano y es único por intento — cumple el mismo
// propósito: invalida automáticamente el token de un intento viejo cuando se
// regenera uno nuevo sobre el mismo Invoice.
// No verifica autenticidad de PagueloFacil (su webhook no está firmado); protege
// contra que se apunte un retorno hacia el invoice/dojo de otro.

function getReturnSecret(): string {
  const secret = process.env.PAGUELOFACIL_RETURN_SECRET;
  if (!secret) throw new Error("PAGUELOFACIL_RETURN_SECRET no configurado en el entorno.");
  return secret;
}

export function signReturnToken(invoiceId: string, dojoId: string, attemptId: string): string {
  return createHmac("sha256", getReturnSecret())
    .update(`${invoiceId}:${dojoId}:${attemptId}`)
    .digest("hex");
}

export function verifyReturnToken(
  invoiceId: string, dojoId: string, attemptId: string, token: string,
): boolean {
  const expected = signReturnToken(invoiceId, dojoId, attemptId);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
}
