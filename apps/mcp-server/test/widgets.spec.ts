import { test, expect } from '@playwright/test';

test.describe('Widget Tests', () => {
  const baseUrl = 'https://rana-flightiest-malcolm.ngrok-free.dev';

  test('ping widget loads', async ({ page }) => {
    await page.goto(`${baseUrl}/widget/ping`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=Component loaded')).toBeVisible();
  });

  test('vehicle widget serves HTML', async ({ page }) => {
    const res = await page.goto(`${baseUrl}/widget/vehicle-results`);
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator('title')).toContainText('AutoAgent Vehicle Search');
  });

  test('ping widget has correct CSP headers', async ({ page }) => {
    const res = await page.goto(`${baseUrl}/widget/ping`);
    const csp = res?.headers()['content-security-policy'];
    expect(csp).toContain('frame-ancestors https://chat.openai.com https://chatgpt.com');
  });

  test('vehicle widget has correct CSP headers', async ({ page }) => {
    const res = await page.goto(`${baseUrl}/widget/vehicle-results`);
    const csp = res?.headers()['content-security-policy'];
    expect(csp).toContain('frame-ancestors https://chat.openai.com https://chatgpt.com');
  });
});
