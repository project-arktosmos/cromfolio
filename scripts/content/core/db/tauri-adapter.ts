/**
 * Tauri adapter for UI
 * Uses Tauri invoke commands for database operations
 * This file should only be imported in browser/Tauri context
 */

import type { DbAdapter } from './db-adapter.js';
import type { ID, Source, Sticker, Provider, Tag, ProviderType, ExternalIdType } from '../types.js';

// Dynamic import to avoid issues when running in Node.js
let invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * Initialize Tauri invoke function
 * Must be called before using the adapter
 */
export async function initTauriAdapter(): Promise<void> {
	const tauriApi = await import('@tauri-apps/api/core');
	invoke = tauriApi.invoke;
}

export function createTauriAdapter(): DbAdapter {
	if (!invoke) {
		throw new Error('Tauri adapter not initialized. Call initTauriAdapter() first.');
	}

	return {
		async providerExists(externalIdType: ExternalIdType, externalId: string): Promise<boolean> {
			return invoke<boolean>('provider_exists', {
				externalIdType,
				externalId
			});
		},

		async createSource(source: Partial<Source>): Promise<Source> {
			return invoke<Source>('create_source', { source });
		},

		async createProvider(
			sourceId: ID,
			providerType: ProviderType,
			externalIdType: ExternalIdType,
			externalId: string
		): Promise<Provider> {
			// Build provider object for the Rust command
			const provider = {
				id: '',
				sourceId: String(sourceId),
				providerType,
				externalIdType,
				externalId
			};
			return invoke<Provider>('create_provider', { provider });
		},

		async createStickersBatch(stickers: Partial<Sticker>[]): Promise<Sticker[]> {
			return invoke<Sticker[]>('create_stickers_batch', { stickers });
		},

		async findOrCreateTag(key: string, value: string): Promise<Tag> {
			// No direct find_or_create command - check existing tags first
			const existingTags = await invoke<Tag[]>('get_tags_by_key', { key });
			const existing = existingTags.find((t) => t.value === value);

			if (existing) {
				return existing;
			}

			// Create new tag
			const tag = { id: '', key, value };
			return invoke<Tag>('create_tag', { tag });
		},

		async addTagToSticker(stickerId: ID, tagId: ID): Promise<void> {
			await invoke<unknown>('add_tag_to_sticker', {
				stickerId: String(stickerId),
				tagId: String(tagId)
			});
		},

		close(): void {
			// No-op for Tauri adapter - connection is managed by the backend
		}
	};
}
