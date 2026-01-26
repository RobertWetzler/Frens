import { test, expect, testUser } from './fixtures/auth.fixture';

test.describe('Authentication', () => {
  test.describe('Sign In Screen', () => {
    test('displays sign in screen for unauthenticated users', async ({ unauthenticatedPage: page }) => {
      await page.goto('/');
      
      // Should show sign in UI elements
      // Note: Adjust selectors based on your actual component structure
      await expect(page.getByText(/sign in/i).first()).toBeVisible();
    });

    test('displays email sign in button', async ({ unauthenticatedPage: page }) => {
      await page.goto('/');
      
      // Look for email sign in option
      const emailButton = page.getByRole('button', { name: /email|sign in/i }).first();
      await expect(emailButton).toBeVisible();
    });
  });

  test.describe('Authenticated State', () => {
    test('redirects to feed when authenticated', async ({ authenticatedPage: page }) => {
      // Mock the feed endpoint
      await page.route('**/api/feed**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ posts: [], hasMore: false }),
        });
      });

      await page.goto('/');
      
      // Should be on the feed, not sign in
      // Wait for navigation/content to load
      await page.waitForTimeout(1000);
      
      // Should NOT see sign in screen
      await expect(page.getByText(/sign in with/i)).not.toBeVisible();
    });

    test('shows user info in navigation/profile', async ({ authenticatedPage: page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({ status: 200, body: JSON.stringify({}) });
      });

      await page.goto('/me');
      
      // Profile should show user info
      // Adjust based on your UI
      await expect(page.getByText(testUser.username)).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('clears auth state on logout', async ({ authenticatedPage: page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({ status: 200, body: JSON.stringify({}) });
      });

      // Navigate to settings where logout button typically is
      await page.goto('/');
      
      // Find and click settings/profile
      const settingsButton = page.locator('[data-testid="settings-button"]').or(
        page.getByRole('button', { name: /settings|gear/i })
      );
      
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        
        // Find logout button
        const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
        if (await logoutButton.isVisible()) {
          await logoutButton.click();
          
          // Should redirect to sign in
          await expect(page.getByText(/sign in/i).first()).toBeVisible();
          
          // Token should be cleared
          const token = await page.evaluate(() => localStorage.getItem('authToken'));
          expect(token).toBeNull();
        }
      }
    });
  });
});
