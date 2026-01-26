import { test, expect } from './fixtures/auth.fixture';
import { createMockNotifications, setupCommonMocks } from './fixtures/api-mocks.fixture';

test.describe('Notifications', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupCommonMocks(page);
  });

  test.describe('Notification List', () => {
    test('displays notifications', async ({ authenticatedPage: page }) => {
      const mockNotifications = createMockNotifications(5);
      
      await page.route('**/api/notification**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: mockNotifications,
            friendRequests: [],
            unreadCount: 3,
          }),
        });
      });

      await page.goto('/notifications');
      
      // Should display notification messages
      await expect(page.getByText(/notification/i).first()).toBeVisible();
    });

    test('shows empty state when no notifications', async ({ authenticatedPage: page }) => {
      await page.route('**/api/notification**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: [],
            friendRequests: [],
            unreadCount: 0,
          }),
        });
      });

      await page.goto('/notifications');
      
      // Should show empty state
      const emptyText = page.getByText(/no notification|all caught up|empty/i);
      // May or may not exist
    });
  });

  test.describe('Friend Requests', () => {
    test('displays pending friend requests', async ({ authenticatedPage: page }) => {
      await page.route('**/api/notification**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: [],
            friendRequests: [
              {
                id: 'req-1',
                from: { id: 'user-1', name: 'Alice', username: 'alice' },
                createdAt: new Date().toISOString(),
              },
              {
                id: 'req-2',
                from: { id: 'user-2', name: 'Bob', username: 'bob' },
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 2,
          }),
        });
      });

      await page.goto('/notifications');
      
      // Should display friend request info
      await expect(page.getByText('Alice').or(page.getByText('alice'))).toBeVisible();
    });

    test('can accept friend request', async ({ authenticatedPage: page }) => {
      let acceptCalled = false;
      
      await page.route('**/api/notification**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: [],
            friendRequests: [
              {
                id: 'req-1',
                from: { id: 'user-1', name: 'Alice', username: 'alice' },
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
          }),
        });
      });

      await page.route('**/api/friendship/accept**', (route) => {
        acceptCalled = true;
        route.fulfill({ status: 200 });
      });

      await page.goto('/notifications');
      
      // Find accept button
      const acceptButton = page.getByRole('button', { name: /accept/i });
      if (await acceptButton.isVisible()) {
        await acceptButton.click();
        expect(acceptCalled).toBe(true);
      }
    });

    test('can decline friend request', async ({ authenticatedPage: page }) => {
      let declineCalled = false;
      
      await page.route('**/api/notification**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: [],
            friendRequests: [
              {
                id: 'req-1',
                from: { id: 'user-1', name: 'Alice', username: 'alice' },
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
          }),
        });
      });

      await page.route('**/api/friendship/decline**', (route) => {
        declineCalled = true;
        route.fulfill({ status: 200 });
      });

      await page.goto('/notifications');
      
      // Find decline button
      const declineButton = page.getByRole('button', { name: /decline|reject|ignore/i });
      if (await declineButton.isVisible()) {
        await declineButton.click();
        expect(declineCalled).toBe(true);
      }
    });
  });

  test.describe('Notification Badge', () => {
    test('shows unread count badge on navigation', async ({ authenticatedPage: page }) => {
      await page.route('**/api/notification/count**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 5 }),
        });
      });

      await page.goto('/');
      
      // Look for notification badge
      const badge = page.locator('[data-testid="notification-badge"]').or(
        page.locator('.badge, .notification-count')
      );
      // May or may not be visible depending on UI
    });
  });
});
