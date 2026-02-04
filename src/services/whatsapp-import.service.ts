import { invoke } from '@tauri-apps/api/core';

export type WhatsappImportStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface WhatsappImportProgress {
	status: WhatsappImportStatus;
	taskId: string | null;
	filePath: string | null;
	packName: string | null;
	totalFiles: number;
	processedFiles: number;
	totalStickers: number;
	processedStickers: number;
	errors: string[];
	startedAt: number | null;
	finishedAt: number | null;
	resultPackIds: string[];
}

/**
 * Start importing WhatsApp sticker packs from file paths in the background
 * Returns the task ID for tracking progress
 */
export async function startWhatsappImport(filePaths: string[]): Promise<string> {
	return await invoke<string>('start_whatsapp_import', { filePaths });
}

/**
 * Get current import progress
 */
export async function getWhatsappImportProgress(): Promise<WhatsappImportProgress> {
	return await invoke<WhatsappImportProgress>('get_whatsapp_import_progress');
}

/**
 * Cancel current import
 */
export async function cancelWhatsappImport(): Promise<boolean> {
	return await invoke<boolean>('cancel_whatsapp_import');
}

/**
 * Reset import state to idle
 */
export async function resetWhatsappImport(): Promise<boolean> {
	return await invoke<boolean>('reset_whatsapp_import');
}
