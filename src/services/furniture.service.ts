/**
 * Furniture Service
 * Manages 3D furniture models via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import { tauriApiService } from '$services/tauri-api.service';
import type { Furniture, FurnitureType } from '$types/furniture.type';

/**
 * Get all furniture items from the database
 */
export async function getAllFurniture(): Promise<Furniture[]> {
	return await tauriApiService.getAll<Furniture>('furniture');
}

/**
 * Get a single furniture item by ID
 */
export async function getFurniture(id: string): Promise<Furniture | null> {
	return await tauriApiService.get<Furniture>('furniture', id);
}

/**
 * Get furniture items by type
 */
export async function getFurnitureByType(furnitureType: FurnitureType): Promise<Furniture[]> {
	try {
		return await invoke<Furniture[]>('get_furniture_by_type', { furnitureType });
	} catch (e) {
		console.error('[furniture.service] getFurnitureByType:', e);
		return [];
	}
}

/**
 * Create a new furniture item
 */
export async function createFurniture(furniture: Furniture): Promise<Furniture | null> {
	return await tauriApiService.create<Furniture>('furniture', furniture);
}

/**
 * Update an existing furniture item
 */
export async function updateFurniture(furniture: Furniture): Promise<Furniture | null> {
	return await tauriApiService.update<Furniture>('furniture', String(furniture.id), furniture);
}

/**
 * Delete a furniture item
 */
export async function deleteFurniture(id: string): Promise<boolean> {
	return await tauriApiService.delete('furniture', id);
}
