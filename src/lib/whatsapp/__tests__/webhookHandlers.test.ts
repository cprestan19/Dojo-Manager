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

  it("does not throw and does not update when the metaMessageId is unknown", async () => {
    mockPrisma.whatsAppNotification.findUnique.mockResolvedValue(null);

    await expect(handleStatusUpdate({
      metaMessageId: "wamid.unknown", status: "delivered", recipientPhone: "+50761234567", timestamp: "1700000000",
    })).resolves.not.toThrow();

    expect(mockPrisma.whatsAppNotification.update).not.toHaveBeenCalled();
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
});
