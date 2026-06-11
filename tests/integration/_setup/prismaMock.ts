import { vi } from "vitest";

/**
 * Minimal Prisma client mock covering the models/methods touched by the
 * integration tests. `$transaction` supports both the array form
 * (`prisma.$transaction([...])`) and the callback form
 * (`prisma.$transaction(async (tx) => ...)`), forwarding `tx` as this
 * same mock object.
 */
export function createPrismaMock() {
  const mock: Record<string, unknown> = {
    student:         mockModel(),
    studentSchedule: mockModel(),
    schedule:        mockModel(),
    attendance:      mockModel(),
    payment:         mockModel(),
    dojo:            mockModel(),
    user:            mockModel(),
    auditLog:        mockModel(),
  };

  mock.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)(mock);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });

  return mock as unknown as PrismaMock;
}

function mockModel() {
  return {
    findMany:   vi.fn(),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  };
}

type ModelMock = {
  findMany:   ReturnType<typeof vi.fn>;
  findFirst:  ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create:     ReturnType<typeof vi.fn>;
  update:     ReturnType<typeof vi.fn>;
  delete:     ReturnType<typeof vi.fn>;
};

export type PrismaMock = {
  student: ModelMock;
  studentSchedule: ModelMock;
  schedule: ModelMock;
  attendance: ModelMock;
  payment: ModelMock;
  dojo: ModelMock;
  user: ModelMock;
  auditLog: ModelMock;
  $transaction: ReturnType<typeof vi.fn>;
};
