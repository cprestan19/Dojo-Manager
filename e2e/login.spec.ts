import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@dojo-principal.com";
const ADMIN_PASSWORD = "Admin123!";

test.describe("Login", () => {
  test("muestra error con credenciales inválidas", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("usuario@dojo.com").fill("noexiste@dojo.com");
    await page.getByPlaceholder("••••••••").fill("ContraseñaIncorrecta1!");
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    await expect(page.getByText(/Credenciales incorrectas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("inicia sesión con credenciales válidas y redirige al dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("usuario@dojo.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });
});
