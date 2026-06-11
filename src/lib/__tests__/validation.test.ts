import { describe, it, expect } from "vitest";
import {
  CreatePaymentSchema,
  UpdatePaymentSchema,
  CreateAttendanceSchema,
  CreateUserSchema,
} from "@/lib/validation";

describe("CreatePaymentSchema", () => {
  const base = {
    studentId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    type: "monthly" as const,
    amount: 25,
    dueDate: "2026-01-31",
  };

  it("accepts a valid monthly payment", () => {
    const result = CreatePaymentSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = CreatePaymentSchema.safeParse({ ...base, amount: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid studentId", () => {
    const result = CreatePaymentSchema.safeParse({ ...base, studentId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid dueDate", () => {
    const result = CreatePaymentSchema.safeParse({ ...base, dueDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("defaults status to pending", () => {
    const result = CreatePaymentSchema.parse(base);
    expect(result.status).toBe("pending");
  });
});

describe("UpdatePaymentSchema", () => {
  it("allows partial updates with only id", () => {
    const result = UpdatePaymentSchema.safeParse({ id: "ckxxxxxxxxxxxxxxxxxxxxxxx" });
    expect(result.success).toBe(true);
  });

  it("rejects amounts above the max", () => {
    const result = UpdatePaymentSchema.safeParse({ id: "ckxxxxxxxxxxxxxxxxxxxxxxx", amount: 100_000 });
    expect(result.success).toBe(false);
  });
});

describe("CreateAttendanceSchema", () => {
  it("accepts a numeric studentCode", () => {
    const result = CreateAttendanceSchema.safeParse({ studentId: "1042", type: "entry" });
    expect(result.success).toBe(true);
  });

  it("accepts a cuid studentId", () => {
    const result = CreateAttendanceSchema.safeParse({ studentId: "ckxxxxxxxxxxxxxxxxxxxxxxx", type: "exit" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid studentId", () => {
    const result = CreateAttendanceSchema.safeParse({ studentId: "not-valid!", type: "entry" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid type", () => {
    const result = CreateAttendanceSchema.safeParse({ studentId: "1042", type: "lunch" });
    expect(result.success).toBe(false);
  });
});

describe("CreateUserSchema", () => {
  const base = {
    name: "Coach Tester",
    email: "Coach@Example.com",
    password: "Password1",
  };

  it("normalizes email to lowercase", () => {
    const result = CreateUserSchema.parse(base);
    expect(result.email).toBe("coach@example.com");
  });

  it("defaults role to user", () => {
    const result = CreateUserSchema.parse(base);
    expect(result.role).toBe("user");
  });

  it("rejects a password without an uppercase letter", () => {
    const result = CreateUserSchema.safeParse({ ...base, password: "password1" });
    expect(result.success).toBe(false);
  });

  it("rejects a password without a number", () => {
    const result = CreateUserSchema.safeParse({ ...base, password: "Password" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = CreateUserSchema.safeParse({ ...base, password: "Pass1" });
    expect(result.success).toBe(false);
  });
});
