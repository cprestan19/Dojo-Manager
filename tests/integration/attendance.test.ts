import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaMock } from "./_setup/prismaMock";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("./_setup/prismaMock");
  const mock = createPrismaMock();
  return { default: mock, prisma: mock };
});
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

const { default: prismaMock } = (await import("@/lib/prisma")) as unknown as { default: PrismaMock };
const { getServerSession } = (await import("next-auth")) as unknown as { getServerSession: ReturnType<typeof vi.fn> };
const { GET, POST } = await import("@/app/api/attendance/route");

function jsonRequest(method: string, body?: unknown, url = "http://localhost/api/attendance") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const ADMIN_SESSION = {
  user: { id: "user-1", role: "admin", dojoId: "dojo-1", name: "Admin", email: "admin@dojo.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  });
});

describe("GET /api/attendance", () => {
  it("returns 401 without a session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for sysadmin without a selected dojo", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", role: "sysadmin", dojoId: null } });
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(403);
  });

  it("returns the dojo's attendances scoped to the session dojoId", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.attendance.findMany.mockResolvedValue([{ id: "att-1" }]);

    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: "att-1" }]);

    const where = prismaMock.attendance.findMany.mock.calls[0][0].where;
    expect(where.student).toEqual({ dojoId: "dojo-1" });
  });
});

describe("POST /api/attendance", () => {
  it("returns 401 without a session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await POST(jsonRequest("POST", { studentId: "s1", type: "entry" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when studentId is missing", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(jsonRequest("POST", { type: "entry" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid type", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(jsonRequest("POST", { studentId: "s1", type: "lunch" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the student does not belong to the dojo", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst.mockResolvedValue(null);

    const res = await POST(jsonRequest("POST", { studentId: "s1", type: "entry" }));
    expect(res.status).toBe(404);

    const where = prismaMock.student.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ id: "s1", dojoId: "dojo-1" });
  });

  it("returns 403 when the student is inactive", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1", fullName: "Ana", firstName: "Ana", lastName: "Lopez",
      photo: null, active: false, dojoId: "dojo-1", beltHistory: [],
    });

    const res = await POST(jsonRequest("POST", { studentId: "s1", type: "entry" }));
    expect(res.status).toBe(403);
  });

  it("flags a duplicate entry within the last 5 minutes without creating a new record", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1", fullName: "Ana Lopez", firstName: "Ana", lastName: "Lopez",
      photo: null, active: true, dojoId: "dojo-1", beltHistory: [{ beltColor: "azul" }],
    });
    prismaMock.attendance.findFirst.mockResolvedValue({ id: "existing" });

    const res = await POST(jsonRequest("POST", { studentId: "s1", type: "entry" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.student.fullName).toBe("Ana Lopez");
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("creates the attendance record and resets attendanceStatus on success", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1", fullName: "Ana Lopez", firstName: "Ana", lastName: "Lopez",
      photo: null, active: true, dojoId: "dojo-1", beltHistory: [{ beltColor: "azul" }],
    });
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1", type: "entry", markedAt: new Date() });
    prismaMock.student.update.mockResolvedValue({ id: "s1" });
    prismaMock.auditLog.create.mockResolvedValue({});

    const res = await POST(jsonRequest("POST", { studentId: "s1", type: "entry" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.attendance.id).toBe("att-1");
    expect(prismaMock.attendance.create).toHaveBeenCalled();
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" }, data: { attendanceStatus: "ACTIVO" } }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});
