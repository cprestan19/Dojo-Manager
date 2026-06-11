// Variables de entorno requeridas por módulos de src/lib durante los tests.
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.NEXTAUTH_SECRET ??= "test-secret-vitest-only";
