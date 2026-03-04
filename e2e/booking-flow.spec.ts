import { test, expect } from "@playwright/test";

test.describe("Randevu akışı", () => {
  test("ana sayfa yüklenir", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("tenant dashboard login sayfası erişilebilir", async ({ page }) => {
    await page.goto("/dashboard/login");
    await expect(page).toHaveURL(/\/dashboard\/login/);
  });

  test("iletişim formu modal açılır (varsa)", async ({ page }) => {
    await page.goto("/");
    const contactBtn = page.getByRole("button", { name: /iletişim|contact/i });
    if (await contactBtn.isVisible()) {
      await contactBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    }
  });
});
