import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { ID } from '$types/core.type';
import type { UserPlacedIcon } from '$types/user-placed-icon.type';

// Service for managing placed icons using localStorage
const placedIconsService = new ArrayServiceClass<UserPlacedIcon>('user-placed-icons', []);

/**
 * Get all placed icons for a collection
 */
export function getPlacedIconsByCollection(collectionId: ID): UserPlacedIcon[] {
	return placedIconsService.filter((icon) => String(icon.collectionId) === String(collectionId));
}

/**
 * Get placed icons for a specific page in a collection
 */
export function getPlacedIconsByPage(collectionId: ID, pageIndex: number): UserPlacedIcon[] {
	return placedIconsService.filter(
		(icon) => String(icon.collectionId) === String(collectionId) && icon.pageIndex === pageIndex
	);
}

/**
 * Get a single placed icon by ID
 */
export function getPlacedIcon(id: ID): UserPlacedIcon | null {
	return placedIconsService.exists(String(id));
}

/**
 * Place an icon on an album page
 */
export function placeIcon(
	iconPath: string,
	collectionId: ID,
	pageIndex: number,
	positionX: number,
	positionY: number,
	scale: number = 1.0,
	rotation: number = 0,
	color: string = '#000000'
): UserPlacedIcon {
	const placedIcon: UserPlacedIcon = {
		id: crypto.randomUUID(),
		iconPath,
		collectionId: String(collectionId),
		pageIndex,
		positionX,
		positionY,
		scale,
		rotation,
		color,
		placedAt: new Date().toISOString()
	};
	placedIconsService.add(placedIcon);
	return placedIcon;
}

/**
 * Update a placed icon's position, scale, rotation, or color
 */
export function updatePlacedIcon(placedIcon: UserPlacedIcon): UserPlacedIcon {
	placedIconsService.update(placedIcon);
	return placedIcon;
}

/**
 * Remove a placed icon
 */
export function removePlacedIcon(id: ID): boolean {
	const icon = placedIconsService.exists(String(id));
	if (icon) {
		placedIconsService.remove(icon);
		return true;
	}
	return false;
}

/**
 * Clear all icons from a collection
 */
export function clearCollectionIcons(collectionId: ID): boolean {
	const icons = getPlacedIconsByCollection(collectionId);
	for (const icon of icons) {
		placedIconsService.remove(icon);
	}
	return true;
}

/**
 * Clear all placed icons
 */
export function clearAllPlacedIcons(): number {
	const all = placedIconsService.all();
	const count = all.length;
	for (const icon of all) {
		placedIconsService.remove(icon);
	}
	return count;
}
