/**
 * Room Service
 * Manages 3D room templates via Tauri backend
 */

import { tauriApiService } from '$services/tauri-api.service';
import type { Room } from '$types/room.type';

/**
 * Get all rooms from the database
 */
export async function getAllRooms(): Promise<Room[]> {
	return await tauriApiService.getAll<Room>('rooms');
}

/**
 * Get a single room by ID
 */
export async function getRoom(id: string): Promise<Room | null> {
	return await tauriApiService.get<Room>('rooms', id);
}

/**
 * Create a new room
 */
export async function createRoom(room: Room): Promise<Room | null> {
	return await tauriApiService.create<Room>('rooms', room);
}

/**
 * Update an existing room
 */
export async function updateRoom(room: Room): Promise<Room | null> {
	return await tauriApiService.update<Room>('rooms', String(room.id), room);
}

/**
 * Delete a room
 */
export async function deleteRoom(id: string): Promise<boolean> {
	return await tauriApiService.delete('rooms', id);
}
