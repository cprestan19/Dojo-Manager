import { MercadoPagoConfig, PreApprovalPlan, PreApproval, Payment } from "mercadopago";

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: MercadoPagoConfig | null = null;

function getClient(): MercadoPagoConfig {
  if (!_client) {
    _client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN ?? "",
    });
  }
  return _client;
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function createMPPreapprovalPlan(
  name: string,
  price: number,
  cycle: "MONTHLY" | "ANNUAL",
): Promise<{ planId: string }> {
  const client = getClient();
  const plan   = new PreApprovalPlan(client);

  const frequencyType = "months";
  const frequency     = cycle === "MONTHLY" ? 1 : 12;

  const result = await plan.create({
    body: {
      reason:          name,
      auto_recurring: {
        frequency,
        frequency_type:        frequencyType,
        transaction_amount:    price,
        currency_id:           "USD",
        free_trial: {
          frequency:      14,
          frequency_type: "days",
        },
      },
      back_url:  process.env.NEXT_PUBLIC_APP_URL ?? "https://dojomasteronline.com",
      status:    "active",
    },
  });

  if (!result.id) throw new Error("MercadoPago plan creation failed — no id returned");
  return { planId: String(result.id) };
}

export async function createMPSubscription(
  planId: string,
  payerEmail: string,
  backUrl: string,
): Promise<{ subscriptionId: string; initPoint: string }> {
  const client       = getClient();
  const preApproval  = new PreApproval(client);

  const result = await preApproval.create({
    body: {
      preapproval_plan_id: planId,
      payer_email:         payerEmail,
      back_url:            backUrl,
      status:              "pending",
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("MercadoPago subscription creation failed");
  }
  return { subscriptionId: String(result.id), initPoint: result.init_point };
}

export async function getMPSubscription(
  subscriptionId: string,
): Promise<{ id: string | number; status: string }> {
  const client      = getClient();
  const preApproval = new PreApproval(client);
  const result      = await preApproval.get({ id: subscriptionId });
  return { id: result.id ?? subscriptionId, status: result.status ?? "unknown" };
}

export async function cancelMPSubscription(
  subscriptionId: string,
): Promise<void> {
  const client      = getClient();
  const preApproval = new PreApproval(client);
  await preApproval.update({
    id:   subscriptionId,
    body: { status: "cancelled" },
  });
}

export async function getMPPayment(paymentId: string | number): Promise<{
  id: string | number;
  status: string;
  transaction_amount?: number;
  preapproval_id?: string;
}> {
  const client  = getClient();
  const payment = new Payment(client);
  const result  = await payment.get({ id: Number(paymentId) });
  return {
    id:                 result.id ?? paymentId,
    status:             result.status ?? "unknown",
    transaction_amount: result.transaction_amount ?? undefined,
    preapproval_id:     (result as unknown as Record<string, unknown>).preapproval_id as string | undefined,
  };
}
