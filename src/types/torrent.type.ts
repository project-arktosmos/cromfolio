import type { ID } from './core.type';

export type TorrentStatus =
	| 'pending'
	| 'initializing'
	| 'checking'
	| 'downloading'
	| 'seeding'
	| 'paused'
	| 'completed'
	| 'error';

export interface TorrentProgressEvent {
	torrentId: string;
	infoHash: string;
	name: string;
	status: TorrentStatus;
	progress: number;
	downloadedBytes: number;
	totalBytes: number;
	downloadSpeed: number;
	uploadSpeed: number;
	peersConnected: number;
	seedsConnected: number;
	etaSeconds?: number;
	message?: string;
}

export interface TorrentAddedEvent {
	torrentId: string;
	infoHash: string;
	name: string;
	totalBytes: number;
	files: TorrentFileInfo[];
}

export interface TorrentFileInfo {
	index: number;
	path: string;
	size: number;
}

export interface TorrentInfo {
	id: ID;
	infoHash: string;
	name: string;
	source: string;
	downloadDir: string;
	status: TorrentStatus;
	progress: number;
	downloadedBytes: number;
	totalBytes: number;
	downloadSpeed: number;
	uploadSpeed: number;
	peersConnected: number;
	seedsConnected: number;
	etaSeconds?: number;
	errorMessage?: string;
	files: TorrentFileInfo[];
	addedAt: string;
	completedAt?: string;
}
