import type { ID } from './core.type';

export type FurnitureType = 'shelf' | 'table' | 'door' | 'window' | 'carpet' | 'decoration';

export const FURNITURE_TYPES: { id: FurnitureType; label: string }[] = [
	{ id: 'shelf', label: 'Shelf' },
	{ id: 'table', label: 'Table' },
	{ id: 'door', label: 'Door' },
	{ id: 'window', label: 'Window' },
	{ id: 'carpet', label: 'Carpet' },
	{ id: 'decoration', label: 'Decoration' }
];

export interface Furniture {
	id: ID;
	name: string;
	furnitureType: FurnitureType;
	/** Path to the 3D model file (relative to /static/model/) */
	modelPath: string;
	/** Scale factor for displaying the model (default 1.0) */
	scale: number;
	/** Optional thumbnail image for preview */
	thumbnail?: string;
	/** Optional description */
	description?: string;
	createdAt?: string;
	updatedAt?: string;
}
