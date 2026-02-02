import type { ID } from '$types/core.type';

/**
 * User-placed icon - tracks icons placed on album pages
 * Icons are SVG files from static/stamp that can be colored
 */
export interface UserPlacedIcon {
	id: ID;
	iconPath: string; // Path to the SVG icon (e.g., /stamp/lorc/sword.svg)
	collectionId: ID;
	pageIndex: number;
	positionX: number; // Percentage 0-100
	positionY: number; // Percentage 0-100
	scale: number; // 0.25 - 3.0
	rotation: number; // -180 to 180 degrees
	color: string; // Hex color (e.g., #000000)
	placedAt: string;
}
