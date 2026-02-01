/**
 * Cards Service
 * Manages a collection of cards within sources via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import { tauriApiService } from '$services/tauri-api.service';
import type { Card } from '$types/card.type';
import type { ID } from '$types/core.type';

/**
 * Get all cards from the database
 */
export async function getCardCollection(): Promise<Card[]> {
	return await tauriApiService.getAll<Card>('cards');
}

/**
 * Get all cards for a specific source
 */
export async function getCardsBySource(sourceId: ID): Promise<Card[]> {
	try {
		return await invoke<Card[]>('get_cards_by_source', { sourceId: String(sourceId) });
	} catch (e) {
		console.error(`[cards.service] getCardsBySource(${sourceId}):`, e);
		return [];
	}
}

/**
 * Add a card to the collection
 */
export async function addCard(card: Card): Promise<Card | null> {
	return await tauriApiService.create<Card>('cards', card);
}

/**
 * Add multiple cards in a single transaction (all or nothing)
 */
export async function addCardsBatch(cards: Card[]): Promise<Card[]> {
	try {
		return await invoke<Card[]>('create_cards_batch', { cards });
	} catch (e) {
		console.error('[cards.service] addCardsBatch:', e);
		throw e;
	}
}

/**
 * Remove a card from the collection
 */
export async function removeCard(card: Card): Promise<boolean> {
	return await tauriApiService.delete('cards', String(card.id));
}

/**
 * Update a card in the collection
 */
export async function updateCard(card: Card): Promise<Card | null> {
	return await tauriApiService.update<Card>('cards', String(card.id), card);
}

/**
 * Check if a card exists in the collection
 */
export async function cardExists(id: ID): Promise<Card | null> {
	return await tauriApiService.get<Card>('cards', String(id));
}

/**
 * Remove all cards for a specific source
 */
export async function removeCardsBySource(sourceId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_cards_by_source', { sourceId: String(sourceId) });
	} catch (e) {
		console.error(`[cards.service] removeCardsBySource(${sourceId}):`, e);
		return false;
	}
}
