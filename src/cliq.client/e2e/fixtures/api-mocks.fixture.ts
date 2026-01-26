import { Page, Route } from '@playwright/test';

/**
 * API mock helpers for consistent test data
 * Mirrors the generated API client structure
 */

export interface MockPost {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  };
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export interface MockCircle {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  isOwner: boolean;
}

export interface MockNotification {
  id: string;
  type: 'friend_request' | 'like' | 'comment' | 'mention';
  message: string;
  createdAt: string;
  isRead: boolean;
  fromUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

/**
 * Creates sample post data
 */
export function createMockPosts(count: number = 5): MockPost[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `post-${i + 1}`,
    content: `This is test post #${i + 1}. Lorem ipsum dolor sit amet.`,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    author: {
      id: `user-${i + 1}`,
      name: `User ${i + 1}`,
      username: `user${i + 1}`,
      avatarUrl: undefined,
    },
    likesCount: Math.floor(Math.random() * 100),
    commentsCount: Math.floor(Math.random() * 20),
    isLiked: Math.random() > 0.5,
  }));
}

/**
 * Creates sample circle data
 */
export function createMockCircles(count: number = 3): MockCircle[] {
  const names = ['Close Friends', 'Family', 'Work', 'College', 'Gaming'];
  return Array.from({ length: count }, (_, i) => ({
    id: `circle-${i + 1}`,
    name: names[i] || `Circle ${i + 1}`,
    description: `Description for circle ${i + 1}`,
    memberCount: Math.floor(Math.random() * 50) + 1,
    isOwner: i === 0,
  }));
}

/**
 * Creates sample notification data
 */
export function createMockNotifications(count: number = 5): MockNotification[] {
  const types: MockNotification['type'][] = ['friend_request', 'like', 'comment', 'mention'];
  return Array.from({ length: count }, (_, i) => ({
    id: `notif-${i + 1}`,
    type: types[i % types.length],
    message: `Notification message ${i + 1}`,
    createdAt: new Date(Date.now() - i * 1800000).toISOString(),
    isRead: i > 2,
    fromUser: {
      id: `user-${i + 10}`,
      name: `Notifier ${i + 1}`,
      avatarUrl: undefined,
    },
  }));
}

/**
 * Sets up common API mocks for a page
 */
export async function setupCommonMocks(page: Page) {
  // Feed endpoint
  await page.route('**/api/feed**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ posts: createMockPosts(10), hasMore: true }),
    });
  });

  // Circles endpoint
  await page.route('**/api/circle**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createMockCircles(5)),
      });
    } else {
      route.continue();
    }
  });

  // Notifications endpoint
  await page.route('**/api/notification**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notifications: createMockNotifications(5),
        friendRequests: [],
        unreadCount: 3,
      }),
    });
  });

  // User profile endpoint
  await page.route('**/api/user/*', (route) => {
    const url = route.request().url();
    const userId = url.split('/').pop();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: userId,
        name: 'Profile User',
        username: 'profileuser',
        bio: 'This is a test bio',
        followersCount: 150,
        followingCount: 75,
        postsCount: 42,
      }),
    });
  });
}

/**
 * Mock API to return an error
 */
export async function mockApiError(page: Page, urlPattern: string, statusCode: number = 500) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Something went wrong' }),
    });
  });
}

/**
 * Mock API to timeout/abort (network failure)
 */
export async function mockNetworkFailure(page: Page, urlPattern: string) {
  await page.route(urlPattern, (route) => {
    route.abort('failed');
  });
}
