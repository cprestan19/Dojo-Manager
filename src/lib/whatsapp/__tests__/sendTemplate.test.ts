import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  whatsAppNotification: {
    findFirst: vi.fn(),
    create:    vi.fn(),
    upsert:    vi.fn(),
    update:    vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
  },
  payment: {
    update: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { sendWhatsAppTemplate, normalizePhoneE164, resolveGuardianContact, buildOverdueVars, buildConfirmedVars } = await import("../sendTemplate");

const baseParams = {
  dojoId: "dojo1",
  studentId: "student1",
  paymentId: "payment1",
  type: "PAYMENT_OVERDUE" as const,
  templateName: "aviso_atraso_dojomaster",
  headerParams: ["Dojo Master Online"],
  bodyParams: ["Juan", "Dojo Test", "27.50", "6", "10%", "62019999"],
};

const optedInStudent = {
  dojoId: "dojo1",
  whatsappOptIn: true,
  primaryGuardian: "mother",
  motherName: "María",
  motherPhone: "+50761234567",
  fatherName: null,
  fatherPhone: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.whatsAppNotification.create.mockResolvedValue({ id: "notif1" });
  mockPrisma.whatsAppNotification.upsert.mockResolvedValue({ id: "notif1" });
  mockPrisma.whatsAppNotification.update.mockResolvedValue({});
  mockPrisma.whatsAppNotification.findFirst.mockResolvedValue(null);
  // Sin fila de Subscription → "todas las funciones" (comportamiento legado,
  // ver featureGate.ts) — el gate por plan no bloquea por default en estos tests.
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn());
});

describe("normalizePhoneE164", () => {
  it("prefixes a local 8-digit Panama number with +507", () => {
    expect(normalizePhoneE164("61234567")).toBe("+50761234567");
  });

  it("keeps a number that already has +507", () => {
    expect(normalizePhoneE164("+50761234567")).toBe("+50761234567");
  });

  it("converts a local Venezuelan mobile number (0-prefixed, 11 digits) to +58", () => {
    expect(normalizePhoneE164("04247220878")).toBe("+584247220878");
  });

  it("strips separators before normalizing (dashes, spaces)", () => {
    expect(normalizePhoneE164("6247-7907")).toBe("+50762477907");
    expect(normalizePhoneE164("+507 62019999")).toBe("+50762019999");
  });

  it("returns null for garbage input", () => {
    expect(normalizePhoneE164("abc")).toBeNull();
    expect(normalizePhoneE164("123")).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
  });
});

describe("resolveGuardianContact", () => {
  it("prefers the phone matching primaryGuardian", () => {
    const result = resolveGuardianContact({
      primaryGuardian: "father",
      motherName: "María", motherPhone: "+50761234567",
      fatherName: "Juan",  fatherPhone: "+50769999999",
    });
    expect(result).toEqual({ name: "Juan", phone: "+50769999999" });
  });

  it("does not send to anyone when primaryGuardian is unset, even if a phone exists", () => {
    const result = resolveGuardianContact({
      primaryGuardian: null,
      motherName: null, motherPhone: null,
      fatherName: "Juan", fatherPhone: "+50769999999",
    });
    expect(result).toEqual({ name: null, phone: null });
  });

  it("does not send to anyone when primaryGuardian is marked but that guardian has no phone", () => {
    const result = resolveGuardianContact({
      primaryGuardian: "mother",
      motherName: "María", motherPhone: null,
      fatherName: "Juan",  fatherPhone: "+50769999999",
    });
    expect(result).toEqual({ name: null, phone: null });
  });
});

// Estructura confirmada vía GET .../message_templates?name=aviso_atraso_dojomaster
// (2026-08-10): HEADER texto {{1}}, BODY con 6 variables, SIN botones — distinto
// a la spec original del prompt (asumía "sin header" y un botón "Pagar ahora").
describe("buildOverdueVars", () => {
  it("produces 1 header param and 6 body params matching the real approved template", () => {
    const result = buildOverdueVars({
      guardianName: "Juan Pérez",
      dojo: { name: "Dojo Natsuki", lateInterestPct: 10, phone: "62452123" },
      student: { fullName: "Karina Cepede" },
      amount: 25,
      daysLate: 6,
    });

    expect(result.headerParams).toEqual(["Dojo Master Online"]);
    expect(result.bodyParams).toEqual([
      "Juan Pérez",       // {{1}} nombre acudiente
      "Dojo Natsuki",     // {{2}} dojo
      "27.50",            // {{3}} monto (25 + 10% de recargo)
      "6",                // {{4}} días de atraso
      "10%",              // {{5}} porcentaje de mora
      "62452123",         // {{6}} contacto del dojo
    ]);
  });

  it("falls back to a generic guardian greeting and dojo contact when missing", () => {
    const result = buildOverdueVars({
      dojo: { name: "Dojo Test", lateInterestPct: 5, phone: null },
      student: { fullName: "Alumno" },
      amount: 10,
      daysLate: 1,
    });
    expect(result.bodyParams[0]).toBe("padre/tutor");
    expect(result.bodyParams[5]).toBe("el dojo");
  });
});

describe("buildConfirmedVars", () => {
  it("produces the 4 body params matching the real approved template", () => {
    const result = buildConfirmedVars({
      guardianName: "María López",
      dojo: { name: "Dojo Natsuki" },
      amount: 60,
      paidDate: "09/08/2026",
    });
    expect(result.bodyParams).toEqual(["María López", "Dojo Natsuki", "60.00", "09/08/2026"]);
  });
});

describe("sendWhatsAppTemplate", () => {
  it("does not call Meta and skips when whatsappOptIn is false", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ ...optedInStudent, whatsappOptIn: false });

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: false, skipped: true, reason: "NO_OPT_IN" });
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppNotification.upsert).not.toHaveBeenCalled();
  });

  it("skips without calling Meta once 2 sends already succeeded for this payment+type (max resends)", async () => {
    mockPrisma.whatsAppNotification.findFirst.mockResolvedValue({ sendCount: 2 });
    mockPrisma.student.findUnique.mockResolvedValue(optedInStudent);

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: false, skipped: true, reason: "ALREADY_SENT" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows a manual resend (2nd send) when only 1 successful send is on record", async () => {
    mockPrisma.whatsAppNotification.findFirst.mockResolvedValue({ sendCount: 1 });
    mockPrisma.student.findUnique.mockResolvedValue(optedInStudent);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.resend-ok" }] }),
    });

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: true, skipped: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("marks FAILED without calling Meta when the phone cannot be normalized", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({
      ...optedInStudent, motherPhone: "not-a-phone", fatherPhone: null,
    });

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("INVALID_PHONE");
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where:  { paymentId_type: { paymentId: "payment1", type: "PAYMENT_OVERDUE" } },
        create: expect.objectContaining({ status: "FAILED" }),
        update: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("retries via upsert (not create) after a previous FAILED attempt for the same payment+type — regression test for the unique-constraint bug", async () => {
    mockPrisma.student.findUnique.mockResolvedValue(optedInStudent);
    // Primer intento: Meta rechaza con un error permanente (4xx, no reintentable).
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 401,
      json: async () => ({ error: { message: "Invalid OAuth access token" } }),
    });
    const first = await sendWhatsAppTemplate(baseParams);
    expect(first).toEqual({ sent: false, skipped: false, reason: "Invalid OAuth access token" });
    expect(mockPrisma.whatsAppNotification.create).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppNotification.upsert).toHaveBeenCalledTimes(1);

    // Segundo intento (reintento manual): ahora Meta responde bien. No debe
    // volver a llamar a create() (chocaría contra unique(paymentId, type)) —
    // debe pasar de nuevo por upsert() y actualizar la misma fila.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.retry-ok" }] }),
    });
    const second = await sendWhatsAppTemplate(baseParams);

    expect(second).toEqual({ sent: true, skipped: false });
    expect(mockPrisma.whatsAppNotification.create).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppNotification.upsert).toHaveBeenCalledTimes(2);
  });

  it("saves metaMessageId and marks SENT on a successful Meta response", async () => {
    mockPrisma.student.findUnique.mockResolvedValue(optedInStudent);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.abc123" }] }),
    });

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: true, skipped: false });
    expect(mockPrisma.whatsAppNotification.update).toHaveBeenCalledWith({
      where: { id: "notif1" },
      data: { status: "SENT", metaMessageId: "wamid.abc123", sendCount: { increment: 1 } },
    });
  });

  it("rejects when the student's dojoId does not match the caller's dojoId", async () => {
    // findUnique ya está scoped por { id, dojoId } — un mismatch real
    // devuelve null desde Prisma; simulamos ese caso.
    mockPrisma.student.findUnique.mockResolvedValue(null);

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: false, skipped: true, reason: "STUDENT_DOJO_MISMATCH" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips without calling Meta when the dojo's plan does not include WhatsApp", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: { featureKeys: JSON.stringify(["dashboard", "students", "payments"]) }, // sin "whatsapp-notifications"
    });
    mockPrisma.student.findUnique.mockResolvedValue(optedInStudent);

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: false, skipped: true, reason: "PLAN_NOT_INCLUDED" });
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("sends normally when the dojo's plan explicitly includes WhatsApp", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: { featureKeys: JSON.stringify(["dashboard", "whatsapp-notifications"]) },
    });
    mockPrisma.student.findUnique.mockResolvedValue(optedInStudent);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.plan-ok" }] }),
    });

    const result = await sendWhatsAppTemplate(baseParams);

    expect(result).toEqual({ sent: true, skipped: false });
  });
});
