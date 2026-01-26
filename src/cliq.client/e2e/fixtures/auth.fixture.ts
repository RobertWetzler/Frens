import { test as base, Page } from '@playwright/test';

/**
 * Test fixtures for authentication state
 * Provides authenticated and unauthenticated page contexts
 */

// Fake JWT token for testing (mimics your auth structure)
const createFakeToken = (userId: string, email: string, username: string) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    nameid: userId,
    email: email,
    unique_name: username,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  }));
  const signature = btoa('fake-signature');
  return `${header}.${payload}.${signature}`;
};

export const testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
};

export const testToken = createFakeToken(testUser.id, testUser.email, testUser.username);

type AuthFixtures = {
  authenticatedPage: Page;
  unauthenticatedPage: Page;
};

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Authenticated page - pre-sets auth token in storage
  authenticatedPage: async ({ page, context }, use) => {
    // Set up API mocks for authenticated state
    await page.route('**/api/user/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testUser),
      });
    });

    // Navigate to page and inject auth state
    await page.goto('/');
    
    // Inject the auth token into localStorage/SecureStore equivalent for web
    await page.evaluate((token) => {
      localStorage.setItem('authToken', token);
    }, testToken);

    // Reload to pick up auth state
    await page.reload();
    
    await use(page);
  },

  // Unauthenticated page - ensures clean state
  unauthenticatedPage: async ({ page }, use) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    await use(page);
  },
});

export { expect } from '@playwright/test';
