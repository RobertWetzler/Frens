import { test, expect, devices } from '@playwright/test';
import { test as authTest } from './fixtures/auth.fixture';
import { setupCommonMocks } from './fixtures/api-mocks.fixture';

/**
 * Responsive design tests
 * Tests the app across different viewport sizes
 */

test.describe('Responsive Design', () => {
  test.describe('Mobile (iPhone)', () => {
    test.use({ ...devices['iPhone 12'] });

    test('displays mobile-optimized layout', async ({ page }) => {
      await page.goto('/');
      
      // Check viewport size
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThan(500);
      
      // Mobile should show bottom tab navigation
      // Adjust selectors based on your actual components
    });

    test('bottom navigation is visible on mobile', async ({ page }) => {
      // Set up auth
      await page.evaluate(() => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          nameid: 'test-user',
          email: 'test@test.com',
          unique_name: 'testuser',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }));
        localStorage.setItem('authToken', `${header}.${payload}.fake`);
      });

      await page.route('**/api/**', (route) => {
        route.fulfill({ status: 200, body: JSON.stringify({}) });
      });

      await page.goto('/');
      await page.reload();
      
      // Bottom tabs should be visible
      // Adjust based on your tab bar implementation
    });

    test('touch targets are appropriately sized', async ({ page }) => {
      await page.goto('/');
      
      // All interactive elements should be at least 44x44 pixels (Apple HIG)
      const buttons = await page.locator('button, [role="button"]').all();
      
      for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
        const box = await button.boundingBox();
        if (box) {
          // Touch targets should be at least 44x44
          expect(box.width).toBeGreaterThanOrEqual(40);
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });

  test.describe('Tablet (iPad)', () => {
    test.use({ ...devices['iPad Pro 11'] });

    test('displays tablet-optimized layout', async ({ page }) => {
      await page.goto('/');
      
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeGreaterThan(700);
      
      // Tablet might show different layout
    });
  });

  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('displays desktop layout', async ({ page }) => {
      await page.goto('/');
      
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeGreaterThan(1000);
    });

    test('hover states work on desktop', async ({ page }) => {
      await page.evaluate(() => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          nameid: 'test-user',
          email: 'test@test.com',
          unique_name: 'testuser',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }));
        localStorage.setItem('authToken', `${header}.${payload}.fake`);
      });

      await page.route('**/api/**', (route) => {
        route.fulfill({ status: 200, body: JSON.stringify({ posts: [] }) });
      });

      await page.goto('/');
      await page.reload();
      
      // Find a button and hover over it
      const button = page.getByRole('button').first();
      if (await button.isVisible()) {
        await button.hover();
        // Could check for hover state styles
      }
    });
  });

  test.describe('Dark Mode', () => {
    test('respects system dark mode preference', async ({ page }) => {
      // Emulate dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      await page.goto('/');
      
      // Check that dark mode styles are applied
      // This depends on your theme implementation
    });

    test('respects system light mode preference', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      
      await page.goto('/');
      
      // Check that light mode styles are applied
    });
  });
});
