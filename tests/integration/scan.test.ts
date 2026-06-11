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
const { GET } = await import("@/app/api/scan/route");

const ADMIN_SESSION = {
  user: { id: "user-1", role: "admin", dojoId: "dojo-1", name: "Admin", email: "admin@dojo.com" },
};

function scanRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/scan");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/scan", () => {
  it("returns 401 without a session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(scanRequest({ id: "1042" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for sysadmin without a selected dojo", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", role: "sysadmin", dojoId: null } });
    const res = await GET(scanRequest({ id: "1042" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when id is missing", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    const res = await GET(scanRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the student is not found in the dojo", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst
      .mockResolvedValueOnce(null)  // resolve studentCode lookup
      .mockResolvedValueOnce(null); // final scoped lookup

    const res = await GET(scanRequest({ id: "9999" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the student is inactive", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst
      .mockResolvedValueOnce({ id: "s1" })
      .mockResolvedValueOnce({
        id: "s1", studentCode: 1042, fullName: "Ana Lopez", firstName: "Ana", lastName: "Lopez",
        photo: null, active: false, beltHistory: [],
      });

    const res = await GET(scanRequest({ id: "1042" }));
    expect(res.status).toBe(403);
  });

  it("returns NOT_ASSIGNED when the student isn't assigned to the requested schedule", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst
      .mockResolvedValueOnce({ id: "s1" })
      .mockResolvedValueOnce({
        id: "s1", studentCode: 1042, fullName: "Ana Lopez", firstName: "Ana", lastName: "Lopez",
        photo: null, active: true, beltHistory: [{ beltColor: "azul", kata: { name: "Heian Shodan" } }],
      });
    prismaMock.studentSchedule.findFirst.mockResolvedValue(null);

    const res = await GET(scanRequest({ id: "1042", scheduleId: "sch-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe("NOT_ASSIGNED");
    expect(body.student.fullName).toBe("Ana Lopez");
  });

  it("returns belt info for a successful scan without scheduleId", async () => {
    getServerSession.mockResolvedValue(ADMIN_SESSION);
    prismaMock.student.findFirst
      .mockResolvedValueOnce({ id: "s1" })
      .mockResolvedValueOnce({
        id: "s1", studentCode: 1042, fullName: "Ana Lopez", firstName: "Ana", lastName: "Lopez",
        photo: null, active: true, beltHistory: [{ beltColor: "azul", kata: { name: "Heian Shodan" } }],
      });

    const res = await GET(scanRequest({ id: "1042" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.belt).toBe("azul");
    expect(body.assigned).toBe(true);

    // Always scoped to the session's dojoId
    const lastCallWhere = prismaMock.student.findFirst.mock.calls[1][0].where;
    expect(lastCallWhere.dojoId).toBe("dojo-1");
  });
});
