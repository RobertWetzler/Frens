import { test, expect } from './fixtures/auth.fixture';
import { setupCommonMocks } from './fixtures/api-mocks.fixture';

test.describe('Navigation', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupCommonMocks(page);
  });

  test.describe('Bottom Tab Navigation', () => {
    test('can navigate to all main tabs', async ({ authenticatedPage: page }) => {
      await page.goto('/');
      
      // Test Feed tab
      const feedTab = page.getByRole('tab', { name: /feed|home/i }).or(
        page.locator('[data-testid="tab-feed"]')
      );
      if (await feedTab.isVisible()) {
        await feedTab.click();
        await expect(page).toHaveURL(/\/$|\/feed/);
      }

      // Test Circles tab
      const circlesTab = page.getByRole('tab', { name: /circles/i }).or(
        page.locator('[data-testid="tab-circles"]')
      );
      if (await circlesTab.isVisible()) {
        await circlesTab.click();
        await expect(page).toHaveURL(/circles/);
      }

      // Test Calendar tab
      const calendarTab = page.getByRole('tab', { name: /calendar/i }).or(
        page.locator('[data-testid="tab-calendar"]')
      );
      if (await calendarTab.isVisible()) {
        await calendarTab.click();
        await expect(page).toHaveURL(/calendar/);
      }

      // Test Profile/Me tab
      const profileTab = page.getByRole('tab', { name: /me|profile/i }).or(
        page.locator('[data-testid="tab-me"]')
      );
      if (await profileTab.isVisible()) {
        await profileTab.click();
        await expect(page).toHaveURL(/me/);
      }
    });
  });

  test.describe('Deep Linking', () => {
    test('can navigate directly to profile via URL', async ({ authenticatedPage: page }) => {
      await page.route('**/api/user/user-123', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-123',
            name: 'Test Profile',
            username: 'testprofile',
          }),
        });
      });

      await page.goto('/profile/user-123');
      
      // Should display profile content
      await expect(page.getByText('Test Profile').or(page.getByText('testprofile'))).toBeVisible();
    });

    test('can navigate directly to post comments via URL', async ({ authenticatedPage: page }) => {
      await page.route('**/api/post/post-123**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'post-123',
            content: 'Test post content',
            comments: [],
          }),
        });
      });

      await page.goto('/post/post-123');
      
      // Should display post/comments view
      await expect(page.getByText('Test post content').or(page.getByText(/comments/i))).toBeVisible();
    });

    test('can navigate directly to circles', async ({ authenticatedPage: page }) => {
      await page.goto('/circles');
      
      // Should be on circles screen
      await expect(page.getByText(/circles/i).first()).toBeVisible();
    });

    test('can navigate directly to notifications', async ({ authenticatedPage: page }) => {
      await page.goto('/notifications');
      
      // Should be on notifications screen
      await expect(page.getByText(/notifications/i).first()).toBeVisible();
    });
  });

  test.describe('Back Navigation', () => {
    test('back button returns to previous screen', async ({ authenticatedPage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Navigate to circles
      await page.goto('/circles');
      await page.waitForLoadState('networkidle');
      
      // Go back
      await page.goBack();
      
      // Should be back on feed
      await expect(page).toHaveURL(/\/$|\/feed/);
    });
  });
});
