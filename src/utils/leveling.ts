import type { LevelInfo } from '$types/player.type';

/**
 * D&D 5e SRD XP thresholds for levels 1-20.
 * Beyond level 20, the formula extrapolates using the same progression pattern.
 */
const XP_THRESHOLDS: number[] = [
	0, // Level 1
	300, // Level 2
	900, // Level 3
	2700, // Level 4
	6500, // Level 5
	14000, // Level 6
	23000, // Level 7
	34000, // Level 8
	48000, // Level 9
	64000, // Level 10
	85000, // Level 11
	100000, // Level 12
	120000, // Level 13
	140000, // Level 14
	165000, // Level 15
	195000, // Level 16
	225000, // Level 17
	265000, // Level 18
	305000, // Level 19
	355000 // Level 20
];

/**
 * Calculate XP required to reach a given level.
 * For levels 1-20, uses D&D 5e SRD thresholds.
 * For levels beyond 20, extrapolates using incremental formula.
 */
export function getXpForLevel(level: number): number {
	if (level <= 0) return 0;
	if (level <= 20) return XP_THRESHOLDS[level - 1];

	// Beyond level 20: continue the progression pattern
	// The increment from 19->20 is 50,000 XP
	// We'll increase each subsequent level by 50,000 + 5,000 per level beyond 20
	let xp = XP_THRESHOLDS[19]; // 355,000 (level 20)
	for (let i = 21; i <= level; i++) {
		const increment = 50000 + (i - 20) * 5000;
		xp += increment;
	}
	return xp;
}

/**
 * Calculate the level for a given amount of XP.
 */
export function getLevelFromXp(xp: number): number {
	if (xp < 0) return 1;

	// Check standard levels 1-20
	for (let level = 1; level <= 20; level++) {
		if (xp < XP_THRESHOLDS[level - 1]) {
			return Math.max(1, level - 1);
		}
	}

	// Beyond level 20
	let level = 20;
	let threshold = XP_THRESHOLDS[19];

	while (true) {
		const nextLevel = level + 1;
		const increment = 50000 + (nextLevel - 20) * 5000;
		const nextThreshold = threshold + increment;

		if (xp < nextThreshold) {
			return level;
		}

		threshold = nextThreshold;
		level = nextLevel;
	}
}

/**
 * Get comprehensive level information for a given XP amount.
 */
export function getLevelInfo(xp: number): LevelInfo {
	const level = getLevelFromXp(xp);
	const xpForCurrentLevel = getXpForLevel(level);
	const xpForNextLevel = getXpForLevel(level + 1);
	const xpIntoLevel = xp - xpForCurrentLevel;
	const xpToNextLevel = xpForNextLevel - xp;
	const levelXpRange = xpForNextLevel - xpForCurrentLevel;
	const progressPercent = levelXpRange > 0 ? (xpIntoLevel / levelXpRange) * 100 : 0;

	return {
		level,
		currentXp: xp,
		xpForCurrentLevel,
		xpForNextLevel,
		xpIntoLevel,
		xpToNextLevel,
		progressPercent: Math.min(100, Math.max(0, progressPercent))
	};
}

/**
 * Format XP number with thousands separators.
 */
export function formatXp(xp: number): string {
	return xp.toLocaleString();
}
