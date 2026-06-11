import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaMock } from "./_setup/prismaMock";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("./_setup/prismaMock");
  const mock = createPrismaMock();
  return { default: mock, prisma: mock };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/billing/subscription", () => ({
  getOrCreateDefaultPlan: vi.fn().mockResolvedValue({ id: "plan-bronce" }),
  createTrialSubscription: vi.fn().mockResolvedValue(undefined),
}));

const { default: prismaMock } = (await import("@/lib/prisma")) as unknown as { default: PrismaMock };
const { sendEmail } = (await import("@/lib/email")) as unknown as { sendEmail: ReturnType<typeof vi.fn> };
const { getOrCreateDefaultPlan, createTrialSubscription } = (await import("@/lib/billing/subscription")) as unknown as {
  getOrCreateDefaultPlan: ReturnType<typeof vi.fn>;
  createTrialSubscription: ReturnType<typeof vi.fn>;
};
const { POST } = await import("@/app/api/public/register/route");

const VALID_BODY = {
  senseiName: "Carlos Mendez",
  dojoName: "Dojo Central",
  country: "Panamá",
  email: "Carlos@Example.com",
  phone: "+507 6000-0000",
  studentCount: "10-20",
  yearsTeaching: "5",
};

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/public/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  });
});

describe("POST /api/public/register", () => {
  it("returns 400 when senseiName is missing", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, senseiName: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when dojoName is missing", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, dojoName: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, phone: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the email is already registered", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user" });

    const res = await POST(jsonRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/Ya existe/);
  });

  it("creates the dojo + admin user, starts a trial and sends emails", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.dojo.findUnique
      .mockResolvedValueOnce(null)              // slug uniqueness check → free
      .mockResolvedValueOnce({ id: "dojo-new" }); // fetch newly created dojo
    prismaMock.dojo.create.mockResolvedValue({ id: "dojo-new", slug: "dojo-central" });
    prismaMock.user.create.mockResolvedValue({ id: "user-new" });
    prismaMock.auditLog.create.mockResolvedValue({});

    const res = await POST(jsonRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.slug).toBe("dojo-central");

    // Email lowercased before duplicate-check and creation
    expect(prismaMock.user.findUnique.mock.calls[0][0].where.email).toBe("carlos@example.com");

    expect(prismaMock.dojo.create).toHaveBeenCalled();
    expect(prismaMock.user.create).toHaveBeenCalled();
    const userData = prismaMock.user.create.mock.calls[0][0].data;
    expect(userData.role).toBe("admin");
    expect(userData.mustChangePassword).toBe(true);

    expect(getOrCreateDefaultPlan).toHaveBeenCalled();
    expect(createTrialSubscription).toHaveBeenCalledWith("dojo-new", "plan-bronce");

    expect(prismaMock.auditLog.create).toHaveBeenCalled();
    const auditData = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(auditData.action).toBe("DOJO_SELF_REGISTERED");

    // Welcome email + founder notification
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
