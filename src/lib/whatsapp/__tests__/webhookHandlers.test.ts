import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  whatsAppNotification: {
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
  whatsAppInboundMessage: {
    upsert: vi.fn(),
  },
  student: {
    findMany: vi.fn(),
  },
  dojo: {
    findMany: vi.fn(),
    update:   vi.fn(),
  },
  dojoLifecycleMessage: {
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { handleStatusUpdate, handleIncomingMessage } = await import("../webhookHandlers");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleStatusUpdate", () => {
  it("updates status when the metaMessageId is known", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue({ id: "notif1", status: "SENT" });

    await handleStatusUpdate({
      metaMessageId: "wamid.abc", status: "delivered", recipientPhone: "+50761234567", timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppNotification.update).toHaveBeenCalledWith({
      where: { id: "notif1" },
      data: { status: "DELIVERED", errorDetail: null },
    });
  });

  it("does not throw and does not update when the metaMessageId is unknown in both tables", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue(null);
    mockPrisma.dojoLifecycleMessage.findUnique.mockResolvedValue(null);

    await expect(handleStatusUpdate({
      metaMessageId: "wamid.unknown", status: "delivered", recipientPhone: "+50761234567", timestamp: "1700000000",
    })).resolves.not.toThrow();

    expect(mockPrisma.whatsAppNotification.update).not.toHaveBeenCalled();
    expect(mockPrisma.dojoLifecycleMessage.update).not.toHaveBeenCalled();
  });

  it("falls back to DojoLifecycleMessage when the metaMessageId isn't a WhatsAppNotification", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue(null);
    mockPrisma.dojoLifecycleMessage.findUnique.mockResolvedValue({ id: "lifecycle1", status: "SENT" });

    await handleStatusUpdate({
      metaMessageId: "wamid.crm1", status: "read", recipientPhone: "+50762019999", timestamp: "1700000000",
    });

    expect(mockPrisma.dojoLifecycleMessage.update).toHaveBeenCalledWith({
      where: { id: "lifecycle1" },
      data: { status: "READ", errorDetail: null },
    });
    expect(mockPrisma.whatsAppNotification.update).not.toHaveBeenCalled();
  });

  it("ignores an out-of-order status update for a DojoLifecycleMessage", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue(null);
    mockPrisma.dojoLifecycleMessage.findUnique.mockResolvedValue({ id: "lifecycle1", status: "READ" });

    await handleStatusUpdate({
      metaMessageId: "wamid.crm2", status: "delivered", recipientPhone: "+50762019999", timestamp: "1700000000",
    });

    expect(mockPrisma.dojoLifecycleMessage.update).not.toHaveBeenCalled();
  });

  it("ignores an out-of-order status update (delivered arriving after read)", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue({ id: "notif1", status: "READ" });

    await handleStatusUpdate({
      metaMessageId: "wamid.abc", status: "delivered", recipientPhone: "+50761234567", timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppNotification.update).not.toHaveBeenCalled();
  });

  it("always applies a failed status even if it arrives out of order", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue({ id: "notif1", status: "READ" });

    await handleStatusUpdate({
      metaMessageId: "wamid.abc", status: "failed", recipientPhone: "+50761234567",
      errorDetail: "Number opted out", timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppNotification.update).toHaveBeenCalledWith({
      where: { id: "notif1" },
      data: { status: "FAILED", errorDetail: "Number opted out" },
    });
  });
});

describe("handleIncomingMessage", () => {
  it("upserts by metaMessageId and links the student when there is exactly one match", async () => {
    mockPrisma.student.findMany.mockResolvedValue([{ id: "student1", dojoId: "dojo1" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in1", type: "text",
      text: "hola", timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppInboundMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { metaMessageId: "wamid.in1" },
        create: expect.objectContaining({ studentId: "student1", dojoId: "dojo1" }),
      }),
    );
  });

  it("leaves studentId/dojoId null when the phone matches students in more than one dojo", async () => {
    mockPrisma.student.findMany.mockResolvedValue([
      { id: "student1", dojoId: "dojoA" },
      { id: "student2", dojoId: "dojoB" },
    ]);
    mockPrisma.dojo.findMany.mockResolvedValue([]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in2", type: "text",
      timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppInboundMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ studentId: null, dojoId: null }),
      }),
    );
  });

  it("links to the dojo owner's phone when no student matches (CRM reply, ej. botón de ayuda_primer_alumno)", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in3", type: "interactive",
      text: "Sí, ayúdame", timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppInboundMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ studentId: null, dojoId: "dojo1", text: "Sí, ayúdame" }),
      }),
    );
  });

  it("leaves dojoId null when the phone ambiguously matches more than one dojo", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1" }, { id: "dojo2" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in4", type: "text",
      timestamp: "1700000000",
    });

    expect(mockPrisma.whatsAppInboundMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ studentId: null, dojoId: null }),
      }),
    );
  });

  it("turns off whatsappOptIn when the dojo owner replies an opt-out phrase", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in5", type: "text",
      text: "Detener", timestamp: "1700000000",
    });

    expect(mockPrisma.dojo.update).toHaveBeenCalledWith({
      where: { id: "dojo1" },
      data: { whatsappOptIn: false, whatsappOptOutDate: expect.any(Date) },
    });
  });

  it("recognizes opt-out phrases regardless of accents/case/punctuation", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in6", type: "text",
      text: "¡YA NO QUIERO MENSAJES!", timestamp: "1700000000",
    });

    expect(mockPrisma.dojo.update).toHaveBeenCalledWith({
      where: { id: "dojo1" },
      data: { whatsappOptIn: false, whatsappOptOutDate: expect.any(Date) },
    });
  });

  it("does not opt out on an unrelated message that merely contains a keyword substring", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in7", type: "text",
      text: "no puedo cancelar mi pago hoy", timestamp: "1700000000",
    });

    expect(mockPrisma.dojo.update).not.toHaveBeenCalled();
  });

  it("does not opt out when the dojo match is ambiguous", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1" }, { id: "dojo2" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in8", type: "text",
      text: "stop", timestamp: "1700000000",
    });

    expect(mockPrisma.dojo.update).not.toHaveBeenCalled();
  });

  it("does not opt out a matched student's guardian phone (opt-out only applies to dojo-owner matches)", async () => {
    mockPrisma.student.findMany.mockResolvedValue([{ id: "student1", dojoId: "dojo1" }]);

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.in9", type: "text",
      text: "stop", timestamp: "1700000000",
    });

    expect(mockPrisma.dojo.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.dojo.update).not.toHaveBeenCalled();
  });
});
