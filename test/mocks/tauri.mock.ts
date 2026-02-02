/**
 * Tauri API Mock
 *
 * Provides utilities for mocking @tauri-apps/api/core in tests.
 * Use this to test services that use Tauri's invoke() function.
 *
 * @example
 * ```typescript
 * import { setupTauriMock, mockTauriCommand } from '../mocks/tauri.mock';
 *
 * describe('myService', () => {
 *   let mockInvoke: ReturnType<typeof setupTauriMock>;
 *
 *   beforeEach(() => {
 *     mockInvoke = setupTauriMock();
 *   });
 *
 *   it('should fetch data', async () => {
 *     mockTauriCommand(mockInvoke, 'get_all_sources', [{ id: '1', title: 'Test' }]);
 *
 *     const result = await getSourceCollection();
 *
 *     expect(result).toHaveLength(1);
 *     expect(mockInvoke).toHaveBeenCalledWith('get_all_sources');
 *   });
 * });
 * ```
 */

import { vi, type Mock } from 'vitest';

/** Type for the mocked invoke function */
export type MockInvoke = Mock<[string, Record<string, unknown>?], Promise<unknown>>;

/** Store for registered command handlers */
const commandHandlers = new Map<string, (args?: Record<string, unknown>) => unknown>();

/**
 * Create and configure a mock for Tauri's invoke function.
 * Call this in beforeEach to reset the mock for each test.
 *
 * @returns The mocked invoke function
 */
export function setupTauriMock(): MockInvoke {
	// Clear previous handlers
	commandHandlers.clear();

	// Create the mock invoke function
	const mockInvoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
		const handler = commandHandlers.get(cmd);
		if (handler) {
			return handler(args);
		}
		throw new Error(`No mock handler registered for command: ${cmd}`);
	});

	// Mock the @tauri-apps/api/core module
	vi.mock('@tauri-apps/api/core', () => ({
		invoke: mockInvoke
	}));

	return mockInvoke;
}

/**
 * Register a mock response for a specific Tauri command.
 *
 * @param mockInvoke - The mock invoke function from setupTauriMock
 * @param command - The Tauri command name (e.g., 'get_all_sources')
 * @param response - The response to return when the command is invoked
 */
export function mockTauriCommand<T>(mockInvoke: MockInvoke, command: string, response: T): void {
	commandHandlers.set(command, () => response);
}

/**
 * Register a mock handler for a specific Tauri command.
 * Use this when you need dynamic responses based on arguments.
 *
 * @param mockInvoke - The mock invoke function from setupTauriMock
 * @param command - The Tauri command name
 * @param handler - Function that receives args and returns the response
 */
export function mockTauriCommandHandler<T>(
	mockInvoke: MockInvoke,
	command: string,
	handler: (args?: Record<string, unknown>) => T
): void {
	commandHandlers.set(command, handler);
}

/**
 * Register a mock error for a specific Tauri command.
 *
 * @param mockInvoke - The mock invoke function from setupTauriMock
 * @param command - The Tauri command name
 * @param error - The error message or Error object to throw
 */
export function mockTauriCommandError(
	mockInvoke: MockInvoke,
	command: string,
	error: string | Error
): void {
	commandHandlers.set(command, () => {
		throw typeof error === 'string' ? new Error(error) : error;
	});
}

/**
 * Clear all registered command handlers.
 * Useful for cleaning up between tests.
 */
export function clearTauriMocks(): void {
	commandHandlers.clear();
}

/**
 * Get the list of registered mock commands.
 * Useful for debugging.
 */
export function getRegisteredMockCommands(): string[] {
	return Array.from(commandHandlers.keys());
}
