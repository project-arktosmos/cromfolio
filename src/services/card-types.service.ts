/**
 * Card Types Service
 * Manages card types via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { CardTypeEntity } from '$types/card-type-entity.type';
import type { ID } from '$types/core.type';

/**
 * Get all card types from the database
 */
export async function getCardTypeCollection(): Promise<CardTypeEntity[]> {
	try {
		return await invoke<CardTypeEntity[]>('get_all_card_types');
	} catch (e) {
		console.error('[card-types.service] getCardTypeCollection:', e);
		return [];
	}
}

/**
 * Get a single card type by ID
 */
export async function getCardType(id: ID): Promise<CardTypeEntity | null> {
	try {
		return await invoke<CardTypeEntity | null>('get_card_type', { id: String(id) });
	} catch (e) {
		console.error(`[card-types.service] getCardType(${id}):`, e);
		return null;
	}
}

/**
 * Get card types by category
 */
export async function getCardTypesByCategory(category: string): Promise<CardTypeEntity[]> {
	try {
		return await invoke<CardTypeEntity[]>('get_card_types_by_category', { category });
	} catch (e) {
		console.error(`[card-types.service] getCardTypesByCategory(${category}):`, e);
		return [];
	}
}

/**
 * Get card types by album type
 */
export async function getCardTypesByAlbumType(albumType: string): Promise<CardTypeEntity[]> {
	try {
		return await invoke<CardTypeEntity[]>('get_card_types_by_album_type', { albumType });
	} catch (e) {
		console.error(`[card-types.service] getCardTypesByAlbumType(${albumType}):`, e);
		return [];
	}
}

/**
 * Add a card type to the collection
 */
export async function addCardType(cardType: CardTypeEntity): Promise<CardTypeEntity | null> {
	try {
		return await invoke<CardTypeEntity>('create_card_type', { cardType });
	} catch (e) {
		console.error('[card-types.service] addCardType:', e);
		return null;
	}
}

/**
 * Update a card type in the collection
 */
export async function updateCardType(cardType: CardTypeEntity): Promise<CardTypeEntity | null> {
	try {
		return await invoke<CardTypeEntity>('update_card_type', { cardType });
	} catch (e) {
		console.error('[card-types.service] updateCardType:', e);
		return null;
	}
}

/**
 * Remove a card type from the collection
 */
export async function removeCardType(cardType: CardTypeEntity): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_card_type', { id: String(cardType.id) });
	} catch (e) {
		console.error('[card-types.service] removeCardType:', e);
		return false;
	}
}
