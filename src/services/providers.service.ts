/**
 * Providers Service
 * Manages provider tracking for duplicate prevention via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { Provider, ExternalIdType, ProviderType } from '$types/provider.type';
import type { ID } from '$types/core.type';

/**
 * Check if a provider with the given external ID already exists
 */
export async function providerExists(
	externalIdType: ExternalIdType,
	externalId: string
): Promise<boolean> {
	try {
		return await invoke<boolean>('provider_exists', {
			externalIdType,
			externalId
		});
	} catch (e) {
		console.error(`[providers.service] providerExists(${externalIdType}, ${externalId}):`, e);
		return false;
	}
}

/**
 * Get a provider by its external ID
 */
export async function getProviderByExternalId(
	externalIdType: ExternalIdType,
	externalId: string
): Promise<Provider | null> {
	try {
		return await invoke<Provider | null>('get_provider_by_external_id', {
			externalIdType,
			externalId
		});
	} catch (e) {
		console.error(
			`[providers.service] getProviderByExternalId(${externalIdType}, ${externalId}):`,
			e
		);
		return null;
	}
}

/**
 * Get all providers for a source
 */
export async function getProvidersBySource(sourceId: ID): Promise<Provider[]> {
	try {
		return await invoke<Provider[]>('get_providers_by_source', {
			sourceId: String(sourceId)
		});
	} catch (e) {
		console.error(`[providers.service] getProvidersBySource(${sourceId}):`, e);
		return [];
	}
}

/**
 * Create a new provider entry
 */
export async function createProvider(
	sourceId: ID,
	providerType: ProviderType,
	externalIdType: ExternalIdType,
	externalId: string
): Promise<Provider | null> {
	try {
		const provider: Provider = {
			id: crypto.randomUUID(),
			sourceId,
			providerType,
			externalIdType,
			externalId
		};
		return await invoke<Provider>('create_provider', { provider });
	} catch (e) {
		console.error(`[providers.service] createProvider:`, e);
		return null;
	}
}

/**
 * Delete a provider entry
 */
export async function deleteProvider(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_provider', { id: String(id) });
	} catch (e) {
		console.error(`[providers.service] deleteProvider(${id}):`, e);
		return false;
	}
}
