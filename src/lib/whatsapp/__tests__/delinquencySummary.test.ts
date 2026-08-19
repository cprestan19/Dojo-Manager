import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  payment: {
    groupBy:   vi.fn(),
    aggregate: vi.fn(),
  },
  whatsAppNotification: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const callMetaGraphApi = vi.fn();
vi.mock("@/lib/whatsapp/sendTemplate", () => ({
  callMetaGraphApi,
  normalizePhoneE164: (raw: string | null | undefined) => (raw ? `+507${raw.replace(/\D/g, "")}` : null),
}));

const {
  computeDelinquencySummary, buildDelinquencySummaryVars, sendDojoDelinquencySummary,
} = await import("../delinquencySummary");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.whatsAppNotification.create.mockResolvedValue({ id: "notif1" });
});

describe("computeDelinquencySummary", () => {
  it("counts distinct late students, sums their amounts, and sums this month's paid amounts separately", async () => {
    mockPrisma.payment.groupBy.mockResolvedValue([
      { studentId: "s1", _sum: { amount: 30 } },
      { studentId: "s2", _sum: { amount: 45 } },
    ]);
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 500 } });

    const result = await computeDelinquencySummary("dojo1");

    expect(result).toEqual({ lateStudents: 2, lateAmount: 75, collectedThisMonth: 500 });
  });

  it("returns zeros when there is nothing late or collected", async () => {
    mockPrisma.payment.groupBy.mockResolvedValue([]);
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const result = await computeDelinquencySummary("dojo1");

    expect(result).toEqual({ lateStudents: 0, lateAmount: 0, collectedThisMonth: 0 });
  });
});

describe("buildDelinquencySummaryVars", () => {
  it("orders body params as dojoName, lateStudents, lateAmount, collectedThisMonth, with $ prefixed (the approved template body has no literal $)", () => {
    const result = buildDelinquencySummaryVars("Dojo Test", {
      lateStudents: 3, lateAmount: 90.5, collectedThisMonth: 1200,
    });
    expect(result.bodyParams).toEqual(["Dojo Test", "3", "$90.50", "$1200.00"]);
  });
});

describe("sendDojoDelinquencySummary", () => {
  const stats = { lateStudents: 2, lateAmount: 75, collectedThisMonth: 500 };

  it("skips without calling Meta when the dojo opted out of WhatsApp", async () => {
    const result = await sendDojoDelinquencySummary(
      { id: "dojo1", name: "Dojo Test", phone: "62019999", whatsappOptIn: false }, stats,
    );
    expect(result).toEqual({ sent: false, reason: "OPT_OUT" });
    expect(callMetaGraphApi).not.toHaveBeenCalled();
  });

  it("skips without calling Meta when the dojo has no valid phone", async () => {
    const result = await sendDojoDelinquencySummary(
      { id: "dojo1", name: "Dojo Test", phone: null, whatsappOptIn: true }, stats,
    );
    expect(result).toEqual({ sent: false, reason: "NO_PHONE" });
    expect(callMetaGraphApi).not.toHaveBeenCalled();
  });

  it("sends via Meta and records a SENT WhatsAppNotification on success", async () => {
    callMetaGraphApi.mockResolvedValue({ ok: true, retryable: false, metaMessageId: "wamid.sum1" });

    const result = await sendDojoDelinquencySummary(
      { id: "dojo1", name: "Dojo Test", phone: "62019999", whatsappOptIn: true }, stats,
    );

    expect(result).toEqual({ sent: true });
    expect(mockPrisma.whatsAppNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dojoId: "dojo1", type: "DOJO_DELINQUENCY_SUMMARY", status: "SENT",
          metaMessageId: "wamid.sum1", sendCount: 1,
        }),
      }),
    );
  });

  it("records a FAILED WhatsAppNotification and returns SEND_FAILED when Meta rejects it", async () => {
    callMetaGraphApi.mockResolvedValue({ ok: false, retryable: false, errorMessage: "Template not approved" });

    const result = await sendDojoDelinquencySummary(
      { id: "dojo1", name: "Dojo Test", phone: "62019999", whatsappOptIn: true }, stats,
    );

    expect(result).toEqual({ sent: false, reason: "SEND_FAILED" });
    expect(mockPrisma.whatsAppNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorDetail: "Template not approved", sendCount: 0 }),
      }),
    );
  });
});
