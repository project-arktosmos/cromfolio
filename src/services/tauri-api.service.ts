import { invoke } from '@tauri-apps/api/core';
import { toastService } from '$services/toast.service';
import type { ID } from '$types/core.type';

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert resource name to singular form
 * e.g., "items" -> "item", "settings" -> "settings"
 */
function toSingular(resource: string): string {
	// Handle special cases
	const specialCases: Record<string, string> = {
		settings: 'settings'
	};

	if (specialCases[resource]) {
		return specialCases[resource];
	}

	// Standard plural -> singular
	return resource.endsWith('s') ? resource.slice(0, -1) : resource;
}

/**
 * Convert kebab-case to snake_case for Rust command names
 */
function toSnakeCase(str: string): string {
	return str.replace(/-/g, '_');
}

/**
 * Convert snake_case to camelCase for Tauri parameter keys
 * e.g., "some_item" -> "someItem"
 */
function toCamelCase(str: string): string {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Extract error message from Tauri error (can be string, Error, or object)
 */
function getErrorMessage(e: unknown, fallback: string): string {
	if (typeof e === 'string') return e;
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object' && 'message' in e) return String(e.message);
	return fallback;
}

/**
 * Admin API service for Tauri commands with toast notifications.
 * Provides CRUD operations for database resources via Tauri IPC.
 */
export const tauriApiService = {
	/**
	 * Get all items of a resource
	 */
	async getAll<T>(resource: string): Promise<T[]> {
		try {
			const commandName = `get_all_${toSnakeCase(resource)}`;
			return await invoke<T[]>(commandName);
		} catch (e) {
			console.error(`[tauriApiService.getAll] ${resource}:`, e);
			toastService.error(getErrorMessage(e, `Failed to load ${resource}`));
			return [];
		}
	},

	/**
	 * Get a single item by ID
	 */
	async get<T>(resource: string, id: ID): Promise<T | null> {
		try {
			const singular = toSingular(toSnakeCase(resource));
			const commandName = `get_${singular}`;
			return await invoke<T | null>(commandName, { id });
		} catch (e) {
			console.error(`[tauriApiService.get] ${resource}/${id}:`, e);
			toastService.error(getErrorMessage(e, `Failed to load ${resource}`));
			return null;
		}
	},

	/**
	 * Create a new item
	 */
	async create<T>(resource: string, data: Partial<T>): Promise<T | null> {
		try {
			const singular = toSingular(toSnakeCase(resource));
			const commandName = `create_${singular}`;
			const paramKey = toCamelCase(singular);
			console.log(`[tauriApiService.create] ${commandName}({ ${paramKey}: ... })`, data);
			const result = await invoke<T>(commandName, { [paramKey]: data });

			toastService.success(`${capitalize(singular.replace(/_/g, ' '))} created`);
			return result;
		} catch (e) {
			console.error(`[tauriApiService.create] ${resource}:`, e);
			toastService.error(getErrorMessage(e, `Failed to create ${resource}`));
			return null;
		}
	},

	/**
	 * Update an existing item
	 */
	async update<T>(
		resource: string,
		id: ID,
		data: Partial<T>,
		options?: { silent?: boolean }
	): Promise<T | null> {
		try {
			const singular = toSingular(toSnakeCase(resource));
			const commandName = `update_${singular}`;
			const paramKey = toCamelCase(singular);
			const payload = { ...data, id };
			console.log(`[tauriApiService.update] ${commandName}({ ${paramKey}: ... })`, payload);
			const result = await invoke<T>(commandName, { [paramKey]: payload });

			if (!options?.silent) {
				toastService.success(`${capitalize(singular.replace(/_/g, ' '))} updated`);
			}
			return result;
		} catch (e) {
			console.error(`[tauriApiService.update] ${resource}/${id}:`, e);
			toastService.error(getErrorMessage(e, `Failed to update ${resource}`));
			return null;
		}
	},

	/**
	 * Delete an item by ID
	 */
	async delete(resource: string, id: ID): Promise<boolean> {
		try {
			const singular = toSingular(toSnakeCase(resource));
			const commandName = `delete_${singular}`;
			await invoke<boolean>(commandName, { id });

			toastService.success(`${capitalize(singular.replace(/_/g, ' '))} deleted`);
			return true;
		} catch (e) {
			console.error(`[tauriApiService.delete] ${resource}/${id}:`, e);
			toastService.error(getErrorMessage(e, `Failed to delete ${resource}`));
			return false;
		}
	},

	/**
	 * Get a single object (for settings, etc.)
	 */
	async getObject<T>(resource: string): Promise<T | null> {
		try {
			const commandName = `get_${toSnakeCase(resource)}`;
			return await invoke<T>(commandName);
		} catch (e) {
			console.error(`[tauriApiService.getObject] ${resource}:`, e);
			toastService.error(getErrorMessage(e, `Failed to load ${resource}`));
			return null;
		}
	},

	/**
	 * Update a single object (for settings, etc.)
	 */
	async updateObject<T>(resource: string, data: T): Promise<T | null> {
		try {
			const snakeResource = toSnakeCase(resource);
			const commandName = `update_${snakeResource}`;
			// Use the resource name as the parameter key
			const paramKey = toCamelCase(snakeResource);
			const result = await invoke<T>(commandName, { [paramKey]: data });

			toastService.success(`${capitalize(resource.replace(/-/g, ' '))} updated`);
			return result;
		} catch (e) {
			console.error(`[tauriApiService.updateObject] ${resource}:`, e);
			toastService.error(getErrorMessage(e, `Failed to update ${resource}`));
			return null;
		}
	}
};
