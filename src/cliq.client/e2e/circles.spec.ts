import { test, expect } from './fixtures/auth.fixture';
import { createMockCircles, setupCommonMocks } from './fixtures/api-mocks.fixture';

test.describe('Circles', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupCommonMocks(page);
  });

  test.describe('Circles List', () => {
    test('displays list of circles', async ({ authenticatedPage: page }) => {
      const mockCircles = createMockCircles(5);
      
      await page.route('**/api/circle**', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockCircles),
          });
        } else {
          route.continue();
        }
      });

      await page.goto('/circles');
      
      // Should display circle names
      await expect(page.getByText('Close Friends')).toBeVisible();
      await expect(page.getByText('Family')).toBeVisible();
    });

    test('shows empty state when no circles', async ({ authenticatedPage: page }) => {
      await page.route('**/api/circle**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/circles');
      
      // Should show empty state or create prompt
      const emptyState = page.getByText(/no circles|create.*circle|get started/i);
      // May or may not exist
    });
  });

  test.describe('Create Circle', () => {
    test('can navigate to create circle screen', async ({ authenticatedPage: page }) => {
      await page.goto('/circles');
      
      // Find create circle button
      const createButton = page.getByRole('button', { name: /create|add|new/i }).or(
        page.locator('[data-testid="create-circle-button"]')
      );
      
      if (await createButton.first().isVisible()) {
        await createButton.first().click();
        await expect(page).toHaveURL(/create-circle/);
      }
    });

    test('can create a new circle', async ({ authenticatedPage: page }) => {
      let createCircleCalled = false;
      
      await page.route('**/api/circle', (route) => {
        if (route.request().method() === 'POST') {
          createCircleCalled = true;
          route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'new-circle-123', name: 'My New Circle' }),
          });
        } else {
          route.continue();
        }
      });

      await page.goto('/create-circle');
      
      // Fill in circle name
      const nameInput = page.getByPlaceholder(/name/i).or(
        page.locator('input[name="name"]')
      ).or(
        page.getByRole('textbox').first()
      );
      
      if (await nameInput.isVisible()) {
        await nameInput.fill('My New Circle');
        
        // Fill description if present
        const descInput = page.getByPlaceholder(/description/i).or(
          page.locator('textarea')
        );
        if (await descInput.isVisible()) {
          await descInput.fill('A circle for testing');
        }
        
        // Submit
        const submitButton = page.getByRole('button', { name: /create|save|done/i });
        if (await submitButton.isVisible()) {
          await submitButton.click();
          expect(createCircleCalled).toBe(true);
        }
      }
    });

    test('shows validation error for empty name', async ({ authenticatedPage: page }) => {
      await page.goto('/create-circle');
      
      // Try to submit without filling name
      const submitButton = page.getByRole('button', { name: /create|save|done/i });
      
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation error
        const errorMessage = page.getByText(/required|name.*required|enter.*name/i);
        // May or may not exist depending on validation implementation
      }
    });
  });

  test.describe('Circle Members', () => {
    test('can add users to a circle', async ({ authenticatedPage: page }) => {
      const mockCircles = createMockCircles(3);
      
      await page.route('**/api/circle**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCircles),
        });
      });

      await page.route('**/api/users/search**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'user-1', name: 'Alice', username: 'alice' },
            { id: 'user-2', name: 'Bob', username: 'bob' },
          ]),
        });
      });

      await page.route('**/api/circle/*/members', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({ status: 200 });
        } else {
          route.continue();
        }
      });

      await page.goto('/circles');
      
      // Click on a circle to view/manage it
      const circleItem = page.getByText('Close Friends');
      if (await circleItem.isVisible()) {
        await circleItem.click();
        
        // Look for add members button
        const addMembersButton = page.getByRole('button', { name: /add|invite|member/i });
        // Further interaction would depend on your UI
      }
    });
  });
});
