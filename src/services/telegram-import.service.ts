import { invoke } from '@tauri-apps/api/core';

export type TelegramImportStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface TelegramImportProgress {
	status: TelegramImportStatus;
	taskId: string | null;
	packName: string | null;
	packTitle: string | null;
	total: number;
	completed: number;
	downloaded: number;
	failed: number;
	currentSticker: string | null;
	errors: string[];
	startedAt: number | null;
	finishedAt: number | null;
	resultPackId: number | null;
}

/**
 * Start importing a Telegram sticker pack in the background
 * Returns the task ID for tracking progress
 */
export async function startTelegramImport(packNameOrUrl: string): Promise<string> {
	return await invoke<string>('start_telegram_import', { packNameOrUrl });
}

/**
 * Get current import progress
 */
export async function getTelegramImportProgress(): Promise<TelegramImportProgress> {
	return await invoke<TelegramImportProgress>('get_telegram_import_progress');
}

/**
 * Cancel current import
 */
export async function cancelTelegramImport(): Promise<boolean> {
	return await invoke<boolean>('cancel_telegram_import');
}

/**
 * Reset import state to idle
 */
export async function resetTelegramImport(): Promise<boolean> {
	return await invoke<boolean>('reset_telegram_import');
}
