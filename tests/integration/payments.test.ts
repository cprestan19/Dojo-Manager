import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaMock } from "./_setup/prismaMock";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("./_setup/prismaMock");
  const mock = createPrismaMock();
  return { default: mock, prisma: mock };
});
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/billing/subscription", () => ({ isDojoReadOnly: vi.fn() }));

const { default: prismaMock } = (await import("@/lib/prisma")) as unknown as { default: PrismaMock };
const { getServerSession } = (await import("next-auth")) as unknown as { getServerSession: ReturnType<typeof vi.fn> };
const { isDojoReadOnly } = (await import("@/lib/billing/subscription")) as unknown as { isDojoReadOnly: ReturnType<typeof vi.fn> };
const { GET, POST, PUT, DELETE } = await import("@/app/api/payments/route");

const ADMIN_SESSION = {
  user: { id: "user-1", role: "admin", dojoId: "dojo-1", name: "Admin", email: "admin@dojo.com" },
};
const USER_SESSION = {
  user: { id: "user-2", role: "user", dojoId: "dojo-1", name: "User", email: "user@dojo.com" },
};

const STUDENT_ID = "ckabcdefghijklmnopqrstuv";
const PAYMENT_ID = "ckpaymentidabcdefghijklmn";

function jsonRequest(method: string, body?: unknown, search = "") {
  return new NextRequest(`http://localhost/api/payments${search}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  isDojoReadOnly.mockResolvedValue(false);
});

describe("GET /api/payments", () => {
  it("returns 401 without a session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for role 'user'", async () => {
    getServerSession.mockResolvedValue(USER_SESSION);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(403);
  });

  it("returns payments scoped to the session dojoId", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.payment.findMany.mockResolvedValue([{ id: PAYMENT_ID }]);

    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(200);

    const where = prismaMock.payment.findMany.mock.calls[0][0].where;
    expect(where.student).toEqual({ dojoId: "dojo-1" });
  });
});

describe("POST /api/payments", () => {
  const validBody = {
    studentId: STUDENT_ID,
    type: "monthly",
    amount: 30,
    dueDate: "2026-01-31",
  };

  it("returns 401 without a session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await POST(jsonRequest("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 READ_ONLY when the dojo subscription requires attention", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    isDojoReadOnly.mockResolvedValue(true);

    const res = await POST(jsonRequest("POST", validBody));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("READ_ONLY");
  });

  it("returns 400 for an invalid body", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(jsonRequest("POST", { ...validBody, amount: -10 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the student does not belong to the dojo", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findUnique.mockResolvedValue(null);

    const res = await POST(jsonRequest("POST", validBody));
    expect(res.status).toBe(404);

    const where = prismaMock.student.findUnique.mock.calls[0][0].where;
    expect(where).toEqual({ id: STUDENT_ID, dojoId: "dojo-1" });
  });

  it("creates the payment and logs an audit entry", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findUnique.mockResolvedValue({ id: STUDENT_ID, dojoId: "dojo-1" });
    prismaMock.payment.create.mockResolvedValue({
      id: PAYMENT_ID, ...validBody, status: "pending",
      student: { fullName: "Ana Lopez", firstName: "Ana", lastName: "Lopez", motherEmail: null, fatherEmail: null },
    });
    prismaMock.auditLog.create.mockResolvedValue({});

    const res = await POST(jsonRequest("POST", validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(PAYMENT_ID);
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
    const auditData = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(auditData.action).toBe("PAYMENT_CREATED");
    expect(auditData.dojoId).toBe("dojo-1");
  });
});

describe("PUT /api/payments", () => {
  it("logs PAYMENT_MARKED_PAID when status transitions to paid", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.payment.findFirst.mockResolvedValue({ status: "pending", amount: 30, dueDate: new Date("2026-01-31") });
    prismaMock.payment.update.mockResolvedValue({ id: PAYMENT_ID, status: "paid", amount: 30, dueDate: new Date("2026-01-31") });
    prismaMock.auditLog.create.mockResolvedValue({});

    const res = await PUT(jsonRequest("PUT", { id: PAYMENT_ID, status: "paid" }));
    expect(res.status).toBe(200);

    const where = prismaMock.payment.update.mock.calls[0][0].where;
    expect(where).toEqual({ id: PAYMENT_ID, student: { dojoId: "dojo-1" } });

    const auditData = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(auditData.action).toBe("PAYMENT_MARKED_PAID");
  });
});

describe("DELETE /api/payments", () => {
  it("returns 404 when the payment belongs to a different dojo", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.payment.findUnique.mockResolvedValue({
      id: PAYMENT_ID, student: { dojoId: "other-dojo", fullName: "Ana" }, amount: 30, type: "monthly", status: "pending",
    });

    const res = await DELETE(jsonRequest("DELETE", { id: PAYMENT_ID }));
    expect(res.status).toBe(404);
    expect(prismaMock.payment.delete).not.toHaveBeenCalled();
  });

  it("deletes the payment and logs an audit entry", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.payment.findUnique.mockResolvedValue({
      id: PAYMENT_ID, student: { dojoId: "dojo-1", fullName: "Ana" }, amount: 30, type: "monthly", status: "pending",
    });
    prismaMock.payment.delete.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const res = await DELETE(jsonRequest("DELETE", { id: PAYMENT_ID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prismaMock.payment.delete).toHaveBeenCalledWith({ where: { id: PAYMENT_ID } });
  });
});
