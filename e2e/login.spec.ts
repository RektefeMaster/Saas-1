import { test, expect } from "@playwright/test";

test.describe("Admin login", () => {
  test("login sayfası yüklenir ve form görünür", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveTitle(/Ahi AI|Giriş|Admin/i);
    await expect(page.getByRole("textbox", { name: /e-posta|email/i })).toBeVisible();
    await expect(page.getByLabel(/şifre|password/i)).toBeVisible();
  });

  test("geçersiz girişte hata mesajı gösterilir", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("textbox", { name: /e-posta|email/i }).fill("invalid@test.com");
    await page.getByLabel(/şifre|password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /devam|continue/i }).click();
    await expect(page.getByText(/geçersiz|invalid|hata|error/i)).toBeVisible({ timeout: 5000 });
  });

  test("admin ana sayfaya yönlendirme linki çalışır", async ({ page }) => {
    await page.goto("/admin/login");
    const homeLink = page.getByRole("link", { name: /ana sayfa|home/i });
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL(/\//);
    }
  });
});
