/**
 * User Placed Icons Service
 *
 * Manages SVG icons placed on album pages.
 * Uses SQLite via Tauri for persistence in the _user_placed_icons table.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserPlacedIcon } from '$types/user-placed-icon.type';

/**
 * Get all placed icons for a collection
 */
export async function getPlacedIconsByCollection(collectionId: ID): Promise<UserPlacedIcon[]> {
	return await invoke<UserPlacedIcon[]>('get_placed_icons_by_collection', {
		collectionId
	});
}

/**
 * Get placed icons for a specific page in a collection
 */
export async function getPlacedIconsByPage(
	collectionId: ID,
	pageIndex: number
): Promise<UserPlacedIcon[]> {
	return await invoke<UserPlacedIcon[]>('get_placed_icons_by_page', {
		collectionId,
		pageIndex
	});
}

/**
 * Get a single placed icon by ID
 */
export async function getPlacedIcon(id: ID): Promise<UserPlacedIcon | null> {
	return await invoke<UserPlacedIcon | null>('get_placed_icon', { id });
}

/**
 * Place an icon on an album page
 */
export async function placeIcon(
	iconPath: string,
	collectionId: ID,
	pageIndex: number,
	positionX: number,
	positionY: number,
	scale: number = 1.0,
	rotation: number = 0,
	color: string = '#000000'
): Promise<UserPlacedIcon> {
	const placedIcon: Partial<UserPlacedIcon> = {
		iconPath,
		collectionId,
		pageIndex,
		positionX,
		positionY,
		scale,
		rotation,
		color
	};
	return await invoke<UserPlacedIcon>('place_icon', { placedIcon });
}

/**
 * Update a placed icon's position, scale, rotation, or color
 */
export async function updatePlacedIcon(placedIcon: UserPlacedIcon): Promise<UserPlacedIcon> {
	return await invoke<UserPlacedIcon>('update_placed_icon', { placedIcon });
}

/**
 * Remove a placed icon
 */
export async function removePlacedIcon(id: ID): Promise<boolean> {
	return await invoke<boolean>('remove_placed_icon', { id });
}

/**
 * Clear all icons from a collection
 */
export async function clearCollectionIcons(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('clear_collection_icons', { collectionId });
}

/**
 * Clear all placed icons
 */
export async function clearAllPlacedIcons(): Promise<number> {
	return await invoke<number>('clear_all_placed_icons');
}
