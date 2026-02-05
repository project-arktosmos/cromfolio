/**
 * Tags Service
 * Manages tags and card-tag relationships via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { Tag, CardTag, StickerTag } from '$types/tag.type';
import type { ID } from '$types/core.type';

// ============================================================================
// TAG CRUD OPERATIONS
// ============================================================================

/**
 * Get all tags from the database
 */
export async function getAllTags(): Promise<Tag[]> {
	try {
		return await invoke<Tag[]>('get_all_tags');
	} catch (e) {
		console.error('[tags.service] getAllTags:', e);
		return [];
	}
}

/**
 * Get a single tag by ID
 */
export async function getTag(id: ID): Promise<Tag | null> {
	try {
		return await invoke<Tag | null>('get_tag', { id });
	} catch (e) {
		console.error(`[tags.service] getTag(${id}):`, e);
		return null;
	}
}

/**
 * Get all tags with a specific key
 */
export async function getTagsByKey(key: string): Promise<Tag[]> {
	try {
		return await invoke<Tag[]>('get_tags_by_key', { key });
	} catch (e) {
		console.error(`[tags.service] getTagsByKey(${key}):`, e);
		return [];
	}
}

/**
 * Get all tags for a specific card
 */
export async function getTagsByCard(cardId: ID): Promise<Tag[]> {
	try {
		return await invoke<Tag[]>('get_tags_by_card', { cardId });
	} catch (e) {
		console.error(`[tags.service] getTagsByCard(${cardId}):`, e);
		return [];
	}
}

/**
 * Create a new tag
 */
export async function createTag(
	tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Tag | null> {
	try {
		return await invoke<Tag>('create_tag', { tag });
	} catch (e) {
		console.error('[tags.service] createTag:', e);
		return null;
	}
}

/**
 * Update an existing tag
 */
export async function updateTag(tag: Tag): Promise<Tag | null> {
	try {
		return await invoke<Tag>('update_tag', { tag });
	} catch (e) {
		console.error('[tags.service] updateTag:', e);
		return null;
	}
}

/**
 * Delete a tag by ID
 */
export async function deleteTag(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_tag', { id });
	} catch (e) {
		console.error(`[tags.service] deleteTag(${id}):`, e);
		return false;
	}
}

// ============================================================================
// CARD-TAG RELATIONSHIP OPERATIONS
// ============================================================================

/**
 * Add a tag to a card
 */
export async function addTagToCard(cardId: ID, tagId: ID): Promise<CardTag | null> {
	try {
		return await invoke<CardTag>('add_tag_to_card', {
			cardId,
			tagId
		});
	} catch (e) {
		console.error(`[tags.service] addTagToCard(${cardId}, ${tagId}):`, e);
		return null;
	}
}

/**
 * Remove a tag from a card
 */
export async function removeTagFromCard(cardId: ID, tagId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('remove_tag_from_card', {
			cardId,
			tagId
		});
	} catch (e) {
		console.error(`[tags.service] removeTagFromCard(${cardId}, ${tagId}):`, e);
		return false;
	}
}

/**
 * Get all card IDs that have a specific tag
 */
export async function getCardIdsByTag(tagId: ID): Promise<number[]> {
	try {
		return await invoke<number[]>('get_card_ids_by_tag', { tagId });
	} catch (e) {
		console.error(`[tags.service] getCardIdsByTag(${tagId}):`, e);
		return [];
	}
}

// ============================================================================
// STICKER-TAG RELATIONSHIP OPERATIONS
// ============================================================================

/**
 * Get all tags for a specific sticker
 */
export async function getTagsBySticker(stickerId: ID): Promise<Tag[]> {
	try {
		return await invoke<Tag[]>('get_tags_by_sticker', { stickerId });
	} catch (e) {
		console.error(`[tags.service] getTagsBySticker(${stickerId}):`, e);
		return [];
	}
}

/**
 * Add a tag to a sticker
 */
export async function addTagToSticker(stickerId: ID, tagId: ID): Promise<StickerTag | null> {
	try {
		return await invoke<StickerTag>('add_tag_to_sticker', {
			stickerId,
			tagId
		});
	} catch (e) {
		console.error(`[tags.service] addTagToSticker(${stickerId}, ${tagId}):`, e);
		return null;
	}
}

/**
 * Remove a tag from a sticker
 */
export async function removeTagFromSticker(stickerId: ID, tagId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('remove_tag_from_sticker', {
			stickerId,
			tagId
		});
	} catch (e) {
		console.error(`[tags.service] removeTagFromSticker(${stickerId}, ${tagId}):`, e);
		return false;
	}
}

/**
 * Get all sticker IDs that have a specific tag
 */
export async function getStickerIdsByTag(tagId: ID): Promise<number[]> {
	try {
		return await invoke<number[]>('get_sticker_ids_by_tag', { tagId });
	} catch (e) {
		console.error(`[tags.service] getStickerIdsByTag(${tagId}):`, e);
		return [];
	}
}

/**
 * Tag a sticker with a key-value pair (creates tag if needed)
 */
export async function tagSticker(stickerId: ID, key: string, value: string): Promise<boolean> {
	const tag = await findOrCreateTag(key, value);
	if (!tag) {
		return false;
	}

	const result = await addTagToSticker(stickerId, tag.id);
	return result !== null;
}

/**
 * Get tags for multiple stickers at once
 * Returns a Map of stickerId -> Tag[]
 */
export async function getTagsForStickers(stickerIds: ID[]): Promise<Map<ID, Tag[]>> {
	const result = new Map<ID, Tag[]>();

	// Fetch all tags in parallel
	const tagPromises = stickerIds.map(async (id) => {
		const tags = await getTagsBySticker(id);
		return { id, tags };
	});

	const results = await Promise.all(tagPromises);

	for (const { id, tags } of results) {
		result.set(id, tags);
	}

	return result;
}

/**
 * Check if a sticker has a specific tag key-value pair
 */
export function hasTag(tags: Tag[], key: string, value: string): boolean {
	return tags.some((tag) => tag.key === key && tag.value === value);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find or create a tag by key-value pair
 * Useful when you want to ensure a tag exists before assigning it
 */
export async function findOrCreateTag(key: string, value: string): Promise<Tag | null> {
	// First try to find existing tag with this key-value
	const existingTags = await getTagsByKey(key);
	const existing = existingTags.find((t) => t.value === value);

	if (existing) {
		return existing;
	}

	// Create new tag
	return await createTag({ key, value });
}

/**
 * Tag a card with a key-value pair (creates tag if needed)
 */
export async function tagCard(cardId: ID, key: string, value: string): Promise<boolean> {
	const tag = await findOrCreateTag(key, value);
	if (!tag) {
		return false;
	}

	const result = await addTagToCard(cardId, tag.id);
	return result !== null;
}

/**
 * Get tag keys that are common to ALL Pokemon stickers
 * A tag key is "common" if every Pokemon sticker has at least one tag with that key
 */
export async function getPokemonCommonTagKeys(): Promise<string[]> {
	try {
		return await invoke<string[]>('get_pokemon_common_tag_keys');
	} catch (e) {
		console.error('[tags.service] getPokemonCommonTagKeys:', e);
		return [];
	}
}

/**
 * Pokemon with tags structure returned from backend
 */
export interface PokemonWithTags {
	id: ID;
	name: string;
	image: string;
	tags: Record<string, string>;
}

/**
 * Get a random Pokemon with all its tags
 * Used for trivia preview in admin panel
 */
export async function getRandomPokemonWithTags(): Promise<PokemonWithTags | null> {
	try {
		return await invoke<PokemonWithTags | null>('get_random_pokemon_with_tags');
	} catch (e) {
		console.error('[tags.service] getRandomPokemonWithTags:', e);
		return null;
	}
}

/**
 * Get random Pokemon from a specific generation (for wrong answers in trivia)
 * Excludes the Pokemon with the given ID
 */
export async function getRandomPokemonByGeneration(
	generation: string,
	excludeId: ID,
	limit: number
): Promise<PokemonWithTags[]> {
	try {
		return await invoke<PokemonWithTags[]>('get_random_pokemon_by_generation', {
			generation,
			excludeId,
			limit
		});
	} catch (e) {
		console.error('[tags.service] getRandomPokemonByGeneration:', e);
		return [];
	}
}
