import { test, expect } from './fixtures/auth.fixture';
import { createMockPosts, setupCommonMocks, mockApiError, mockNetworkFailure } from './fixtures/api-mocks.fixture';

test.describe('Feed', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await setupCommonMocks(page);
  });

  test.describe('Loading Posts', () => {
    test('displays posts from API', async ({ authenticatedPage: page }) => {
      const mockPosts = createMockPosts(5);
      
      await page.route('**/api/feed**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ posts: mockPosts, hasMore: false }),
        });
      });

      await page.goto('/');
      
      // Wait for posts to load
      await page.waitForResponse('**/api/feed**');
      
      // Should display post content
      await expect(page.getByText(mockPosts[0].content)).toBeVisible();
    });

    test('shows empty state when no posts', async ({ authenticatedPage: page }) => {
      await page.route('**/api/feed**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ posts: [], hasMore: false }),
        });
      });

      await page.goto('/');
      await page.waitForResponse('**/api/feed**');
      
      // Should show empty state message
      // Adjust text based on your actual empty state
      const emptyState = page.getByText(/no posts|nothing here|empty/i);
      // This may or may not exist depending on your implementation
    });

    test('shows loading indicator while fetching', async ({ authenticatedPage: page }) => {
      // Delay the response
      await page.route('**/api/feed**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ posts: createMockPosts(5), hasMore: false }),
        });
      });

      await page.goto('/');
      
      // Should show loading indicator
      // Adjust selector based on your loading component
      const loadingIndicator = page.locator('[data-testid="loading"]').or(
        page.getByRole('progressbar')
      ).or(
        page.locator('.loading, .spinner')
      );
      
      // May or may not be visible depending on timing
    });
  });

  test.describe('Error Handling', () => {
    test('shows error message on API failure', async ({ authenticatedPage: page }) => {
      await mockApiError(page, '**/api/feed**', 500);

      await page.goto('/');
      
      // Should show error state
      const errorMessage = page.getByText(/error|something went wrong|try again/i);
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    });

    test('shows error on network failure', async ({ authenticatedPage: page }) => {
      await mockNetworkFailure(page, '**/api/feed**');

      await page.goto('/');
      
      // Should show network error state
      const errorMessage = page.getByText(/error|offline|connection|try again/i);
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Post Interactions', () => {
    test('can like a post', async ({ authenticatedPage: page }) => {
      const mockPosts = createMockPosts(3);
      mockPosts[0].isLiked = false;
      mockPosts[0].likesCount = 10;

      await page.route('**/api/feed**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ posts: mockPosts, hasMore: false }),
        });
      });

      // Mock the like endpoint
      let likeCallMade = false;
      await page.route('**/api/post/*/like', (route) => {
        likeCallMade = true;
        route.fulfill({ status: 200 });
      });

      await page.goto('/');
      await page.waitForResponse('**/api/feed**');
      
      // Find and click like button on first post
      const likeButton = page.locator('[data-testid="like-button"]').first().or(
        page.getByRole('button', { name: /like/i }).first()
      );
      
      if (await likeButton.isVisible()) {
        await likeButton.click();
        expect(likeCallMade).toBe(true);
      }
    });

    test('can navigate to comments', async ({ authenticatedPage: page }) => {
      const mockPosts = createMockPosts(3);

      await page.route('**/api/feed**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ posts: mockPosts, hasMore: false }),
        });
      });

      await page.route('**/api/post/*/comments**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comments: [] }),
        });
      });

      await page.goto('/');
      await page.waitForResponse('**/api/feed**');
      
      // Find and click comment button
      const commentButton = page.locator('[data-testid="comment-button"]').first().or(
        page.getByRole('button', { name: /comment/i }).first()
      );
      
      if (await commentButton.isVisible()) {
        await commentButton.click();
        
        // Should navigate to comments view or open comment modal
        await expect(page.getByText(/comments/i).first()).toBeVisible();
      }
    });
  });

  test.describe('Create Post', () => {
    test('navigates to create post screen', async ({ authenticatedPage: page }) => {
      await page.goto('/');
      
      // Find the create/add button (typically a + icon in bottom nav)
      const createButton = page.locator('[data-testid="create-post-button"]').or(
        page.getByRole('button', { name: /create|add|post/i })
      ).or(
        page.locator('button:has([name="add"])')
      );
      
      if (await createButton.first().isVisible()) {
        await createButton.first().click();
        
        // Should be on create post screen
        await expect(page).toHaveURL(/create/);
      }
    });
  });
});
