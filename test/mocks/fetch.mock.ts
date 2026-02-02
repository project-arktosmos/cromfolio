/**
 * Fetch API Mock
 *
 * Provides utilities for mocking the global fetch function in tests.
 * Use this to test services that make HTTP requests.
 *
 * @example
 * ```typescript
 * import { setupFetchMock, mockFetchResponse, mockFetchError } from '../mocks/fetch.mock';
 *
 * describe('apiService', () => {
 *   let mockFetch: ReturnType<typeof setupFetchMock>;
 *
 *   beforeEach(() => {
 *     mockFetch = setupFetchMock();
 *   });
 *
 *   it('should fetch data', async () => {
 *     mockFetchResponse(mockFetch, { title: 'Test Movie', year: 2024 });
 *
 *     const result = await fetchMovieDetails('tt1234567');
 *
 *     expect(result.title).toBe('Test Movie');
 *   });
 *
 *   it('should handle errors', async () => {
 *     mockFetchError(mockFetch, 'Not Found', 404);
 *
 *     await expect(fetchMovieDetails('invalid')).rejects.toThrow();
 *   });
 * });
 * ```
 */

import { vi, type Mock } from 'vitest';

/** Type for the mocked fetch function */
export type MockFetch = Mock<[RequestInfo | URL, RequestInit?], Promise<Response>>;

/** Queue of responses for sequential mocking */
const responseQueue: Array<{
	matcher?: string | RegExp;
	response: () => Promise<Response>;
}> = [];

/**
 * Create and configure a mock for the global fetch function.
 * Call this in beforeEach to reset the mock for each test.
 *
 * @returns The mocked fetch function
 */
export function setupFetchMock(): MockFetch {
	// Clear previous responses
	responseQueue.length = 0;

	// Create the mock fetch function
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

		// Find a matching response
		const matchIndex = responseQueue.findIndex((item) => {
			if (!item.matcher) return true;
			if (typeof item.matcher === 'string') return url.includes(item.matcher);
			return item.matcher.test(url);
		});

		if (matchIndex >= 0) {
			const item = responseQueue[matchIndex];
			// Remove from queue if it's a one-time response (no matcher)
			if (!item.matcher) {
				responseQueue.splice(matchIndex, 1);
			}
			return item.response();
		}

		throw new Error(`No mock response registered for URL: ${url}`);
	}) as MockFetch;

	// Replace global fetch
	global.fetch = mockFetch;

	return mockFetch;
}

/**
 * Create a mock Response object.
 *
 * @param data - The response data (will be JSON serialized)
 * @param options - Response options (status, headers, etc.)
 */
function createMockResponse<T>(
	data: T,
	options: {
		ok?: boolean;
		status?: number;
		statusText?: string;
		headers?: Record<string, string>;
	} = {}
): Response {
	const { ok = true, status = 200, statusText = 'OK', headers = {} } = options;

	const body = JSON.stringify(data);

	return {
		ok,
		status,
		statusText,
		headers: new Headers({ 'Content-Type': 'application/json', ...headers }),
		json: () => Promise.resolve(data),
		text: () => Promise.resolve(body),
		blob: () => Promise.resolve(new Blob([body])),
		arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
		formData: () => Promise.reject(new Error('Not implemented')),
		clone: function () {
			return this;
		},
		body: null,
		bodyUsed: false,
		redirected: false,
		type: 'basic' as ResponseType,
		url: ''
	} as Response;
}

/**
 * Register a successful mock response for the next fetch call.
 * The response will be consumed (one-time use).
 *
 * @param mockFetch - The mock fetch function from setupFetchMock
 * @param data - The response data
 * @param status - HTTP status code (default: 200)
 */
export function mockFetchResponse<T>(mockFetch: MockFetch, data: T, status: number = 200): void {
	responseQueue.push({
		response: async () =>
			createMockResponse(data, {
				ok: status >= 200 && status < 300,
				status
			})
	});
}

/**
 * Register a mock error response for the next fetch call.
 *
 * @param mockFetch - The mock fetch function from setupFetchMock
 * @param message - Error message or status text
 * @param status - HTTP status code (default: 500)
 */
export function mockFetchError(mockFetch: MockFetch, message: string, status: number = 500): void {
	responseQueue.push({
		response: async () =>
			createMockResponse(
				{ error: message },
				{
					ok: false,
					status,
					statusText: message
				}
			)
	});
}

/**
 * Register a network error for the next fetch call.
 * This simulates connection failures, timeouts, etc.
 *
 * @param mockFetch - The mock fetch function from setupFetchMock
 * @param message - Error message
 */
export function mockFetchNetworkError(
	mockFetch: MockFetch,
	message: string = 'Network error'
): void {
	responseQueue.push({
		response: async () => {
			throw new Error(message);
		}
	});
}

/**
 * Register a persistent mock response for a URL pattern.
 * Unlike mockFetchResponse, this will match multiple calls.
 *
 * @param mockFetch - The mock fetch function from setupFetchMock
 * @param urlMatcher - String or RegExp to match against the URL
 * @param data - The response data
 * @param status - HTTP status code (default: 200)
 */
export function mockFetchUrl<T>(
	mockFetch: MockFetch,
	urlMatcher: string | RegExp,
	data: T,
	status: number = 200
): void {
	responseQueue.push({
		matcher: urlMatcher,
		response: async () =>
			createMockResponse(data, {
				ok: status >= 200 && status < 300,
				status
			})
	});
}

/**
 * Clear all registered mock responses.
 */
export function clearFetchMocks(): void {
	responseQueue.length = 0;
}

/**
 * Get the number of pending mock responses.
 * Useful for debugging.
 */
export function getPendingFetchMocks(): number {
	return responseQueue.length;
}
