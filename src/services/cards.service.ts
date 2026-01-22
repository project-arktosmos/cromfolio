/**
 * Cards Service
 * Manages a collection of cards within albums via Tauri backend
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
 * Get all cards for a specific album
 */
export async function getCardsByAlbum(albumId: ID): Promise<Card[]> {
	try {
		return await invoke<Card[]>('get_cards_by_album', { albumId: String(albumId) });
	} catch (e) {
		console.error(`[cards.service] getCardsByAlbum(${albumId}):`, e);
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
 * Remove all cards for a specific album
 */
export async function removeCardsByAlbum(albumId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_cards_by_album', { albumId: String(albumId) });
	} catch (e) {
		console.error(`[cards.service] removeCardsByAlbum(${albumId}):`, e);
		return false;
	}
}
