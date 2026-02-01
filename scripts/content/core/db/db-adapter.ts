/**
 * Database adapter interface for content extraction
 * Abstracts database operations to allow different implementations:
 * - SQLite adapter for CLI scripts (direct DB access)
 * - Tauri adapter for UI (via invoke commands)
 */

import type { ID, Source, Sticker, Provider, Tag, ProviderType, ExternalIdType } from '../types.js';

export interface DbAdapter {
	/**
	 * Check if a provider with the given external ID already exists
	 * Used to prevent duplicate entries
	 */
	providerExists(externalIdType: ExternalIdType, externalId: string): Promise<boolean>;

	/**
	 * Create a new source record
	 */
	createSource(source: Partial<Source>): Promise<Source>;

	/**
	 * Create a provider record to track the external ID
	 */
	createProvider(
		sourceId: ID,
		providerType: ProviderType,
		externalIdType: ExternalIdType,
		externalId: string
	): Promise<Provider>;

	/**
	 * Batch create multiple stickers
	 * All stickers are inserted atomically (all or none)
	 */
	createStickersBatch(stickers: Partial<Sticker>[]): Promise<Sticker[]>;

	/**
	 * Find an existing tag by key/value, or create a new one
	 */
	findOrCreateTag(key: string, value: string): Promise<Tag>;

	/**
	 * Associate a tag with a sticker
	 */
	addTagToSticker(stickerId: ID, tagId: ID): Promise<void>;

	/**
	 * Close the database connection (cleanup)
	 */
	close(): void;
}
