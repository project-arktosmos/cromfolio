import type { ID } from '$types/core.type';

export interface Player {
	id: ID;
	name: string;
	experience: number;
	createdAt: string;
	lastPlayedAt: string;
}

export interface LevelInfo {
	level: number;
	currentXp: number;
	xpForCurrentLevel: number;
	xpForNextLevel: number;
	xpIntoLevel: number;
	xpToNextLevel: number;
	progressPercent: number;
}
