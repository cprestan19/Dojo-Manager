import { test, expect } from "@playwright/test";

test.describe("Registro público de dojo", () => {
  test("crea una cuenta nueva y muestra la pantalla de bienvenida", async ({ page }) => {
    const unique = Date.now();
    const senseiName = `Sensei E2E ${unique}`;
    const dojoName = `Dojo E2E ${unique}`;
    const email = `e2e-${unique}@example.com`;

    await page.goto("/register");

    await page.getByPlaceholder("Ej. Carlos Molina").fill(senseiName);
    await page.getByPlaceholder("Ej. Dojo Bushido").fill(dojoName);
    await page.getByPlaceholder("sensei@midojo.com").fill(email);
    await page.getByPlaceholder("+507 6000-0000").fill("+507 6000-0000");
    // Selects: 0 = País (default Panamá), 1 = ¿Cuántos alumnos? (opcional), 2 = años enseñando (requerido)
    await page.getByRole("combobox").nth(2).selectOption("1-3");

    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole("button", { name: /Crear cuenta gratis/ }).click();

    await expect(page.getByText(`¡Bienvenido, ${senseiName}!`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(dojoName)).toBeVisible();
  });
});
