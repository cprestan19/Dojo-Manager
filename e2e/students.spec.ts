import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@dojo-principal.com";
const ADMIN_PASSWORD = "Admin123!";

test.describe("Alumnos", () => {
  test("login como admin y crea un nuevo alumno", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("usuario@dojo.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto("/dashboard/students/new");

    const fullName = `Alumno E2E ${Date.now()}`;
    await page.getByPlaceholder("Ej. Carlos Rodríguez").fill(fullName);
    await page.locator('input[name="birthDate"]').fill("2010-01-15");

    await page.getByRole("button", { name: /Guardar Alumno/ }).first().click();

    await expect(page).toHaveURL(/\/dashboard\/students\/[a-z0-9]+$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: fullName })).toBeVisible({ timeout: 15_000 });
  });
});
