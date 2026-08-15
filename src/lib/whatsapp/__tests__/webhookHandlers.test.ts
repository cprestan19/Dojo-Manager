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
  crmSettings: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockSendFreeformText    = vi.fn().mockResolvedValue({ ok: true, retryable: false, metaMessageId: "wamid.bot" });
const mockSendInteractiveList = vi.fn().mockResolvedValue({ ok: true, retryable: false, metaMessageId: "wamid.bot" });

vi.mock("@/lib/whatsapp/sendTemplate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sendTemplate")>();
  return {
    ...actual,
    sendFreeformText:    mockSendFreeformText,
    sendInteractiveList: mockSendInteractiveList,
  };
});

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
  });
});

describe("handleIncomingMessage — support bot", () => {
  it("does nothing when supportBotEnabled is off (default)", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: false });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot1", type: "text",
      text: "Sí, ayúdame", timestamp: "1700000000",
    });

    expect(mockSendInteractiveList).not.toHaveBeenCalled();
    expect(mockSendFreeformText).not.toHaveBeenCalled();
  });

  it("sends the menu when the dojo owner taps 'Sí, ayúdame'", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot2", type: "interactive",
      text: "Sí, ayúdame",
      interactive: { kind: "button_reply", id: "Sí, ayúdame", title: "Sí, ayúdame" },
      timestamp: "1700000000",
    });

    expect(mockSendInteractiveList).toHaveBeenCalledWith("+50761234567", expect.any(String), expect.any(String), expect.any(Array));
  });

  it("sends the topic script when a menu option is selected (list_reply)", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot3", type: "interactive",
      text: "Agregar un alumno",
      interactive: { kind: "list_reply", id: "topic_student", title: "Agregar un alumno" },
      timestamp: "1700000000",
    });

    expect(mockSendFreeformText).toHaveBeenCalledTimes(1);
    expect(mockSendFreeformText.mock.calls[0]![0]).toBe("+50761234567");
    expect(mockSendFreeformText.mock.calls[0]![1]).toContain("Nuevo Alumno");
  });

  it("escalates to support (alerts SUPPORT_PHONE + confirms to the dojo) when the support row is picked", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot4", type: "interactive",
      text: "Hablar con soporte",
      interactive: { kind: "list_reply", id: "support_human", title: "Hablar con soporte" },
      timestamp: "1700000000",
    });

    expect(mockSendFreeformText).toHaveBeenCalledTimes(2);
    const recipients = mockSendFreeformText.mock.calls.map(c => c[0]);
    expect(recipients).toContain("+50761234567"); // confirmación al dojo
    expect(recipients).toContain("+50766261768"); // alerta al número de soporte
  });

  it("escalates to support on free text containing a support keyword, without going through the menu", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot5", type: "text",
      text: "soporte", timestamp: "1700000000",
    });

    expect(mockSendInteractiveList).not.toHaveBeenCalled();
    expect(mockSendFreeformText).toHaveBeenCalledTimes(2);
  });

  it("acknowledges 'Ya lo tengo controlado' without the catch-all confusion reply", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot6", type: "interactive",
      text: "Ya lo tengo controlado",
      interactive: { kind: "button_reply", id: "Ya lo tengo controlado", title: "Ya lo tengo controlado" },
      timestamp: "1700000000",
    });

    expect(mockSendFreeformText).toHaveBeenCalledTimes(1);
    expect(mockSendFreeformText.mock.calls[0]![1]).not.toContain("No entendí");
  });

  it("sends the catch-all reply for unrecognized free text", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot7", type: "text",
      text: "cuánto cuesta el plan anual", timestamp: "1700000000",
    });

    expect(mockSendFreeformText).toHaveBeenCalledTimes(1);
    expect(mockSendFreeformText.mock.calls[0]![1]).toContain("No entendí");
  });

  it("never runs the bot when the message was an opt-out phrase", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.dojo.findMany.mockResolvedValue([{ id: "dojo1", name: "Dojo Test" }]);
    mockPrisma.crmSettings.findUnique.mockResolvedValue({ supportBotEnabled: true });

    await handleIncomingMessage({
      fromPhone: "61234567", messageId: "wamid.bot8", type: "text",
      text: "stop", timestamp: "1700000000",
    });

    expect(mockPrisma.dojo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ whatsappOptIn: false }) }),
    );
    expect(mockSendFreeformText).not.toHaveBeenCalled();
    expect(mockSendInteractiveList).not.toHaveBeenCalled();
  });
});
