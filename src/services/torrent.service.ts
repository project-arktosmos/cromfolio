import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
	TorrentAddedEvent,
	TorrentInfo,
	TorrentProgressEvent
} from '$types/torrent.type';

// ============================================================================
// Tauri Commands
// ============================================================================

/**
 * Add a torrent from magnet URI or .torrent file path
 */
export async function addTorrent(
	source: string,
	downloadDir?: string
): Promise<TorrentAddedEvent> {
	return invoke<TorrentAddedEvent>('add_torrent', { source, downloadDir });
}

/**
 * List all active torrents with their current status
 */
export async function listTorrents(): Promise<TorrentInfo[]> {
	return invoke<TorrentInfo[]>('list_torrents');
}

/**
 * Pause a torrent by ID
 */
export async function pauseTorrent(torrentId: string): Promise<boolean> {
	return invoke<boolean>('pause_torrent', { torrentId });
}

/**
 * Resume a paused torrent by ID
 */
export async function resumeTorrent(torrentId: string): Promise<boolean> {
	return invoke<boolean>('resume_torrent', { torrentId });
}

/**
 * Remove a torrent by ID
 * @param torrentId The torrent ID to remove
 * @param deleteFiles Whether to delete downloaded files
 */
export async function removeTorrent(
	torrentId: string,
	deleteFiles: boolean = false
): Promise<boolean> {
	return invoke<boolean>('remove_torrent', { torrentId, deleteFiles });
}

/**
 * Get the default download directory path
 */
export async function getTorrentDownloadDir(): Promise<string> {
	return invoke<string>('get_torrent_download_dir');
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Listen for torrent progress updates
 */
export function onTorrentProgress(
	callback: (event: TorrentProgressEvent) => void
): Promise<UnlistenFn> {
	return listen<TorrentProgressEvent>('torrent_progress', (event) => {
		callback(event.payload);
	});
}

/**
 * Listen for when a torrent is added
 */
export function onTorrentAdded(
	callback: (event: TorrentAddedEvent) => void
): Promise<UnlistenFn> {
	return listen<TorrentAddedEvent>('torrent_added', (event) => {
		callback(event.payload);
	});
}

/**
 * Listen for when a torrent completes
 */
export function onTorrentCompleted(
	callback: (event: TorrentProgressEvent) => void
): Promise<UnlistenFn> {
	return listen<TorrentProgressEvent>('torrent_completed', (event) => {
		callback(event.payload);
	});
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * Format bytes per second to human readable speed
 */
export function formatSpeed(bytesPerSec: number): string {
	return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format ETA seconds to human readable time
 */
export function formatEta(seconds?: number): string {
	if (!seconds || seconds <= 0) return '--';

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	}
	return `${secs}s`;
}

/**
 * Format progress as percentage string
 */
export function formatProgress(progress: number): string {
	return `${(progress * 100).toFixed(1)}%`;
}

/**
 * Get status display color class for DaisyUI
 */
export function getStatusColor(status: string): string {
	switch (status) {
		case 'downloading':
			return 'text-info';
		case 'seeding':
			return 'text-success';
		case 'completed':
			return 'text-success';
		case 'paused':
			return 'text-warning';
		case 'error':
			return 'text-error';
		case 'checking':
		case 'initializing':
			return 'text-info';
		default:
			return 'text-base-content';
	}
}

/**
 * Get status badge class for DaisyUI
 */
export function getStatusBadgeClass(status: string): string {
	switch (status) {
		case 'downloading':
			return 'badge-info';
		case 'seeding':
			return 'badge-success';
		case 'completed':
			return 'badge-success';
		case 'paused':
			return 'badge-warning';
		case 'error':
			return 'badge-error';
		case 'checking':
		case 'initializing':
			return 'badge-info';
		default:
			return 'badge-ghost';
	}
}

/**
 * Validate if a string is a valid magnet URI
 */
export function isValidMagnetUri(uri: string): boolean {
	return uri.startsWith('magnet:?') && uri.includes('xt=urn:btih:');
}
