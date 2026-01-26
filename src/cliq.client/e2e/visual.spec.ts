import { test, expect } from '@playwright/test';
import { test as authTest } from './fixtures/auth.fixture';
import { createMockPosts, setupCommonMocks } from './fixtures/api-mocks.fixture';

/**
 * Visual regression tests
 * Compares screenshots against baseline images
 * 
 * First run will create baseline screenshots in e2e/visual.spec.ts-snapshots/
 * Subsequent runs will compare against baselines
 * 
 * Update baselines: npx playwright test --update-snapshots
 */

test.describe('Visual Regression', () => {
  test.describe.configure({ mode: 'serial' });

  test('sign in page visual', async ({ page }) => {
    await page.goto('/');
    
    // Wait for animations to settle
    await page.waitForTimeout(500);
    
    // Take screenshot (will create baseline on first run)
    await expect(page).toHaveScreenshot('sign-in-page.png', {
      maxDiffPixels: 100, // Allow small differences
      threshold: 0.2,
    });
  });

  test('feed page visual - empty state', async ({ page }) => {
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

    await page.route('**/api/feed**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: [], hasMore: false }),
      });
    });

    await page.route('**/api/**', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await page.goto('/');
    await page.reload();
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('feed-empty.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('feed page visual - with posts', async ({ page }) => {
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

    await page.route('**/api/feed**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          posts: createMockPosts(3), 
          hasMore: false 
        }),
      });
    });

    await page.route('**/api/**', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await page.goto('/');
    await page.reload();
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('feed-with-posts.png', {
      maxDiffPixels: 200, // Posts may have dynamic content
      threshold: 0.3,
    });
  });

  test('circles page visual', async ({ page }) => {
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

    await setupCommonMocks(page);
    
    await page.goto('/circles');
    await page.reload();
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('circles-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test.describe('Dark Mode Visuals', () => {
    test('sign in page - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('sign-in-dark.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('feed page - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      
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
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('feed-dark.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });
  });
});
