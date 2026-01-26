# E2E Tests with Playwright

End-to-end tests for the Frens app using [Playwright](https://playwright.dev/).

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI (great for debugging)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run only Chromium tests (fastest)
npm run test:chromium

# Run mobile tests only
npm run test:mobile

# Run visual regression tests
npm run test:visual

# Update visual snapshots
npm run test:update-snapshots
```

## Test Structure

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts       # Auth state fixtures
│   └── api-mocks.fixture.ts  # API mock helpers
├── auth.spec.ts              # Authentication tests
├── feed.spec.ts              # Feed/posts tests
├── navigation.spec.ts        # Navigation/routing tests
├── circles.spec.ts           # Circles feature tests
├── notifications.spec.ts     # Notifications tests
├── responsive.spec.ts        # Responsive design tests
└── visual.spec.ts            # Visual regression tests
```

## Writing Tests

### Using Auth Fixtures

```typescript
import { test, expect, testUser } from './fixtures/auth.fixture';

test('authenticated test', async ({ authenticatedPage: page }) => {
  // page is already authenticated
  await page.goto('/feed');
  // ...
});

test('unauthenticated test', async ({ unauthenticatedPage: page }) => {
  // page has no auth state
  await page.goto('/');
  // ...
});
```

### Mocking API Responses

```typescript
import { createMockPosts, setupCommonMocks } from './fixtures/api-mocks.fixture';

test('test with mocked data', async ({ page }) => {
  await setupCommonMocks(page); // Sets up common API mocks
  
  // Or mock specific endpoints
  await page.route('**/api/feed**', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ posts: createMockPosts(5) }),
    });
  });
});
```

### Visual Regression

Visual tests compare screenshots against baselines:

```typescript
test('visual test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('page-name.png');
});
```

First run creates baselines. Update with:
```bash
npm run test:update-snapshots
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npm test
  working-directory: src/cliq.client

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: src/cliq.client/playwright-report/
```

## Tips

1. **Selectors**: Use `data-testid` attributes for reliable selectors
2. **Waiting**: Playwright auto-waits, but use `waitForResponse` for API calls
3. **Debugging**: Use `page.pause()` to pause and inspect in headed mode
4. **Traces**: Check `playwright-report/` after failures for detailed traces
