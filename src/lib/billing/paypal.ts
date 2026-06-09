import {
  ApiError,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
} from "@paypal/paypal-server-sdk";

// ── Singleton client ──────────────────────────────────────────────────────────

function buildClient() {
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId:     process.env.PAYPAL_CLIENT_ID     ?? "",
      oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    },
    environment: mode === "live" ? Environment.Production : Environment.Sandbox,
  });
}

let _client: Client | null = null;
function getClient(): Client {
  if (!_client) _client = buildClient();
  return _client;
}

// PayPal REST base URL (catalog / subscriptions not in the SDK — use fetch)
function baseUrl(): string {
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken(): Promise<string> {
  const id     = process.env.PAYPAL_CLIENT_ID     ?? "";
  const secret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  const creds  = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token error: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function paypalRequest<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal ${method} ${path} failed (${res.status}): ${err}`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function createPayPalProduct(
  name: string,
  description: string,
): Promise<{ productId: string }> {
  const data = await paypalRequest<{ id: string }>("/v1/catalogs/products", "POST", {
    name,
    description,
    type:     "SERVICE",
    category: "SOFTWARE",
  });
  return { productId: data.id };
}

export async function createPayPalPlan(
  productId: string,
  name: string,
  monthlyPrice: number,
  annualPrice: number,
  cycle: "MONTHLY" | "ANNUAL",
): Promise<{ planId: string }> {
  const price = cycle === "MONTHLY" ? monthlyPrice : annualPrice;
  const intervalUnit  = cycle === "MONTHLY" ? "MONTH" : "YEAR";
  const intervalCount = 1;

  const data = await paypalRequest<{ id: string }>("/v1/billing/plans", "POST", {
    product_id: productId,
    name:       `${name} (${cycle === "MONTHLY" ? "Mensual" : "Anual"})`,
    status:     "ACTIVE",
    billing_cycles: [
      {
        frequency:     { interval_unit: "DAY", interval_count: 14 },
        tenure_type:   "TRIAL",
        sequence:      1,
        total_cycles:  1,
        pricing_scheme: { fixed_price: { value: "0", currency_code: "USD" } },
      },
      {
        frequency:     { interval_unit: intervalUnit, interval_count: intervalCount },
        tenure_type:   "REGULAR",
        sequence:      2,
        total_cycles:  0,
        pricing_scheme: {
          fixed_price: { value: price.toFixed(2), currency_code: "USD" },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding:        true,
      setup_fee_failure_action:     "CONTINUE",
      payment_failure_threshold:    3,
    },
  });
  return { planId: data.id };
}

export async function createPayPalSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string,
): Promise<{ subscriptionId: string; approveUrl: string }> {
  const data = await paypalRequest<{
    id: string;
    links: { href: string; rel: string }[];
  }>("/v1/billing/subscriptions", "POST", {
    plan_id:       planId,
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: "SUBSCRIBE_NOW",
    },
  });

  const approveLink = data.links.find(l => l.rel === "approve");
  if (!approveLink) throw new Error("PayPal subscription approve URL not found");

  return { subscriptionId: data.id, approveUrl: approveLink.href };
}

export async function getPayPalSubscription(
  subscriptionId: string,
): Promise<{ id: string; status: string; billing_info?: { next_billing_time?: string } }> {
  return paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`, "GET");
}

export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason: string,
): Promise<void> {
  await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/cancel`, "POST", { reason });
}

// Re-export client for SDK usage in webhook verification
export { getClient as getPayPalClient };
