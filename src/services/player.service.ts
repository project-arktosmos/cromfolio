/**
 * Player Service
 *
 * Manages the player profile data (name, experience, etc.)
 * Uses SQLite via Tauri for persistence in the _user_player table.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Player } from '$types/player.type';

/**
 * Get the current player profile
 * Creates a default player if none exists
 */
export async function getPlayer(): Promise<Player> {
	return await invoke<Player>('get_user_player');
}

/**
 * Update the player profile
 */
export async function updatePlayer(player: Player): Promise<Player> {
	return await invoke<Player>('update_user_player', { player });
}

/**
 * Add experience to the player
 */
export async function addExperience(amount: number): Promise<Player> {
	return await invoke<Player>('add_user_experience', { amount });
}

/**
 * Set the player's name
 */
export async function setPlayerName(name: string): Promise<Player> {
	return await invoke<Player>('set_user_player_name', { name });
}

/**
 * Reset the player profile to defaults
 */
export async function resetPlayer(): Promise<Player> {
	return await invoke<Player>('reset_user_player');
}
