/**
 * 3D Model Types
 *
 * Internal types for 3D models and related content.
 * These are the normalized internal representations used throughout the app.
 */

/**
 * 3D model representation (normalized from Sketchfab, etc.)
 */
export interface Model3D {
	id: string;
	name: string;
	description?: string;
	thumbnailUrl?: string;
	embedUrl: string;
	viewerUrl?: string;
	downloadUrl?: string;
	author?: {
		id: string;
		username: string;
		displayName?: string;
		avatar?: string;
		profileUrl?: string;
	};
	license?: {
		slug: string;
		label: string;
		fullName?: string;
		url?: string;
	};
	tags?: string[];
	categories?: string[];
	createdAt?: string; // ISO date
	publishedAt?: string; // ISO date
	viewCount?: number;
	likeCount?: number;
	commentCount?: number;
	downloadCount?: number;
	faceCount?: number;
	vertexCount?: number;
	textureCount?: number;
	isAnimated?: boolean;
	hasSound?: boolean;
	isDownloadable?: boolean;
	archives?: Model3DArchive[];
	sketchfabId?: string;
}

/**
 * 3D model archive/download format
 */
export interface Model3DArchive {
	format: string; // e.g., 'gltf', 'fbx', 'obj', 'usdz'
	size?: number; // bytes
	url?: string;
	textured?: boolean;
}

/**
 * 3D model thumbnail/preview image
 */
export interface Model3DThumbnail {
	url: string;
	width: number;
	height: number;
	size?: number; // bytes
}

/**
 * 3D model animation representation
 */
export interface Model3DAnimation {
	id: string;
	name: string;
	duration?: number; // seconds
}

/**
 * 3D model texture representation
 */
export interface Model3DTexture {
	id: string;
	name: string;
	type?: 'diffuse' | 'normal' | 'specular' | 'roughness' | 'metallic' | 'ao' | 'emission' | 'other';
	width?: number;
	height?: number;
	url?: string;
}

/**
 * 3D model collection representation
 */
export interface Model3DCollection {
	id: string;
	name: string;
	description?: string;
	modelCount: number;
	thumbnailUrl?: string;
	author?: {
		id: string;
		username: string;
		displayName?: string;
	};
	createdAt?: string;
	updatedAt?: string;
}

/**
 * License types commonly used for 3D models
 */
export type Model3DLicenseType =
	| 'cc0' // Public Domain
	| 'cc-by' // Attribution
	| 'cc-by-sa' // Attribution-ShareAlike
	| 'cc-by-nc' // Attribution-NonCommercial
	| 'cc-by-nc-sa' // Attribution-NonCommercial-ShareAlike
	| 'cc-by-nd' // Attribution-NoDerivatives
	| 'cc-by-nc-nd' // Attribution-NonCommercial-NoDerivatives
	| 'standard' // Standard license (platform-specific)
	| 'editorial' // Editorial use only
	| 'other';

/**
 * Get human-readable license name
 */
export function getLicenseLabel(license: Model3DLicenseType): string {
	const labels: Record<Model3DLicenseType, string> = {
		cc0: 'Public Domain (CC0)',
		'cc-by': 'Attribution (CC BY)',
		'cc-by-sa': 'Attribution-ShareAlike (CC BY-SA)',
		'cc-by-nc': 'Attribution-NonCommercial (CC BY-NC)',
		'cc-by-nc-sa': 'Attribution-NonCommercial-ShareAlike (CC BY-NC-SA)',
		'cc-by-nd': 'Attribution-NoDerivatives (CC BY-ND)',
		'cc-by-nc-nd': 'Attribution-NonCommercial-NoDerivatives (CC BY-NC-ND)',
		standard: 'Standard License',
		editorial: 'Editorial Use Only',
		other: 'Other'
	};
	return labels[license] || license;
}
