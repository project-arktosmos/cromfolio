import type { ID } from './core.type';

/**
 * A furniture placement within a room
 * Stores position, rotation, and scale for a furniture item
 */
export interface RoomFurniture {
	/** Reference to furniture.id */
	furnitureId: string;
	/** Position in 3D space */
	position: { x: number; y: number; z: number };
	/** Rotation in radians (Euler angles) */
	rotation: { x: number; y: number; z: number };
	/** Scale multiplier (applied on top of furniture's base scale) */
	scale: number;
}

/**
 * Room dimensions and bounds
 */
export interface RoomDimensions {
	width: number;
	height: number;
	depth: number;
}

/**
 * Player movement bounds within the room
 */
export interface RoomBounds {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

/**
 * Room wall/floor/ceiling colors
 */
export interface RoomColors {
	floor: string;
	ceiling: string;
	walls: string;
}

/**
 * Camera spawn configuration
 */
export interface RoomCameraSpawn {
	position: { x: number; y: number; z: number };
	/** Initial camera pitch in radians */
	pitch: number;
}

/**
 * Room entity - defines a 3D room template
 */
export interface Room {
	id: ID;
	name: string;
	description?: string;
	/** Room dimensions */
	dimensions: RoomDimensions;
	/** Player movement bounds */
	bounds: RoomBounds;
	/** Room surface colors (hex) */
	colors: RoomColors;
	/** Camera spawn point and orientation */
	cameraSpawn: RoomCameraSpawn;
	/** Furniture placements in this room */
	furniture: RoomFurniture[];
	/** Optional thumbnail image */
	thumbnail?: string;
	/** Timestamps */
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Default room configuration based on current /game/room implementation
 */
export const DEFAULT_ROOM: Omit<Room, 'id' | 'name'> = {
	dimensions: {
		width: 8,
		height: 4,
		depth: 10
	},
	bounds: {
		minX: -3.5,
		maxX: 3.5,
		minZ: -4,
		maxZ: 4.5
	},
	colors: {
		floor: '#8b7355',
		ceiling: '#f5f5f5',
		walls: '#e8e4de'
	},
	cameraSpawn: {
		position: { x: 0, y: 1.4, z: -0.8 },
		pitch: -0.35
	},
	furniture: []
};
