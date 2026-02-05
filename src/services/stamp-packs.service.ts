/**
 * Stamp Packs Service
 * Manages imported sticker packs (WhatsApp, Telegram, etc.) via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { StampPack, Stamp } from '$types/stamp-pack.type';
import type { ID } from '$types/core.type';

// ============================================================================
// STAMP PACK CRUD OPERATIONS
// ============================================================================

/**
 * Get all stamp packs from the database
 */
export async function getAllStampPacks(): Promise<StampPack[]> {
	try {
		return await invoke<StampPack[]>('get_all_stamp_packs');
	} catch (e) {
		console.error('[stamp-packs.service] getAllStampPacks:', e);
		return [];
	}
}

/**
 * Get stamp packs filtered by source (e.g., 'whatsapp', 'telegram')
 */
export async function getStampPacksBySource(source: string): Promise<StampPack[]> {
	try {
		return await invoke<StampPack[]>('get_stamp_packs_by_source', { source });
	} catch (e) {
		console.error(`[stamp-packs.service] getStampPacksBySource(${source}):`, e);
		return [];
	}
}

/**
 * Get a single stamp pack by ID
 */
export async function getStampPack(id: ID): Promise<StampPack | null> {
	try {
		return await invoke<StampPack | null>('get_stamp_pack', { id });
	} catch (e) {
		console.error(`[stamp-packs.service] getStampPack(${id}):`, e);
		return null;
	}
}

/**
 * Create a new stamp pack
 * @param stampPack - Pack data. If id is provided, it will be used; otherwise backend generates one.
 */
export async function createStampPack(
	stampPack: Omit<StampPack, 'createdAt' | 'updatedAt'> & { id?: number }
): Promise<StampPack | null> {
	try {
		return await invoke<StampPack>('create_stamp_pack', { stampPack });
	} catch (e) {
		console.error('[stamp-packs.service] createStampPack:', e);
		return null;
	}
}

/**
 * Update an existing stamp pack
 */
export async function updateStampPack(stampPack: StampPack): Promise<StampPack | null> {
	try {
		return await invoke<StampPack>('update_stamp_pack', { stampPack });
	} catch (e) {
		console.error('[stamp-packs.service] updateStampPack:', e);
		return null;
	}
}

/**
 * Delete a stamp pack by ID
 */
export async function deleteStampPack(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_stamp_pack', { id });
	} catch (e) {
		console.error(`[stamp-packs.service] deleteStampPack(${id}):`, e);
		return false;
	}
}

// ============================================================================
// STAMP CRUD OPERATIONS
// ============================================================================

/**
 * Get all stamps from the database
 */
export async function getAllStamps(): Promise<Stamp[]> {
	try {
		return await invoke<Stamp[]>('get_all_stamps');
	} catch (e) {
		console.error('[stamp-packs.service] getAllStamps:', e);
		return [];
	}
}

/**
 * Get stamps for a specific pack
 */
export async function getStampsByPack(packId: ID): Promise<Stamp[]> {
	try {
		return await invoke<Stamp[]>('get_stamps_by_pack', { packId });
	} catch (e) {
		console.error(`[stamp-packs.service] getStampsByPack(${packId}):`, e);
		return [];
	}
}

/**
 * Get a single stamp by ID
 */
export async function getStamp(id: ID): Promise<Stamp | null> {
	try {
		return await invoke<Stamp | null>('get_stamp', { id });
	} catch (e) {
		console.error(`[stamp-packs.service] getStamp(${id}):`, e);
		return null;
	}
}

/**
 * Create a new stamp
 */
export async function createStamp(stamp: Omit<Stamp, 'id' | 'createdAt'>): Promise<Stamp | null> {
	try {
		return await invoke<Stamp>('create_stamp', { stamp });
	} catch (e) {
		console.error('[stamp-packs.service] createStamp:', e);
		return null;
	}
}

/**
 * Create multiple stamps in a batch
 */
export async function createStampsBatch(
	stamps: Omit<Stamp, 'id' | 'createdAt'>[]
): Promise<Stamp[]> {
	try {
		return await invoke<Stamp[]>('create_stamps_batch', { stamps });
	} catch (e) {
		console.error('[stamp-packs.service] createStampsBatch:', e);
		return [];
	}
}

/**
 * Delete a stamp by ID
 */
export async function deleteStamp(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_stamp', { id });
	} catch (e) {
		console.error(`[stamp-packs.service] deleteStamp(${id}):`, e);
		return false;
	}
}

/**
 * Delete all stamps for a pack
 */
export async function deleteStampsByPack(packId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_stamps_by_pack', { packId });
	} catch (e) {
		console.error(`[stamp-packs.service] deleteStampsByPack(${packId}):`, e);
		return false;
	}
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get the stamps data directory path
 */
export async function getStampsDataDir(): Promise<string> {
	try {
		return await invoke<string>('get_stamps_data_dir');
	} catch (e) {
		console.error('[stamp-packs.service] getStampsDataDir:', e);
		throw e;
	}
}

/**
 * Copy a file to the stamps data directory
 */
export async function copyFileToStampsDir(
	sourcePath: string,
	destFilename: string
): Promise<string> {
	try {
		return await invoke<string>('copy_file_to_stamps_dir', { sourcePath, destFilename });
	} catch (e) {
		console.error('[stamp-packs.service] copyFileToStampsDir:', e);
		throw e;
	}
}

/**
 * Write binary data to a stamp file
 */
export async function writeStampFile(
	packId: string,
	filename: string,
	data: Uint8Array
): Promise<string> {
	try {
		return await invoke<string>('write_stamp_file', {
			packId,
			filename,
			data: Array.from(data)
		});
	} catch (e) {
		console.error('[stamp-packs.service] writeStampFile:', e);
		throw e;
	}
}

/**
 * Delete a stamp pack's files from the stamps data directory
 */
export async function deleteStampPackFiles(packId: string): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_stamp_pack_files', { packId });
	} catch (e) {
		console.error(`[stamp-packs.service] deleteStampPackFiles(${packId}):`, e);
		return false;
	}
}
