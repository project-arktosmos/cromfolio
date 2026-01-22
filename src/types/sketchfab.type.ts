/**
 * Sketchfab API Types
 * Based on Sketchfab Data API v3
 */

export interface SketchfabModel {
	uid: string;
	name: string;
	description?: string;
	isDownloadable: boolean;
	publishedAt: string;
	viewCount: number;
	likeCount: number;
	commentCount: number;
	faceCount: number;
	vertexCount: number;
	animationCount: number;
	tags: SketchfabTag[];
	categories: SketchfabCategory[];
	user: SketchfabUser;
	thumbnails: SketchfabThumbnails;
	license?: SketchfabLicense;
	viewerUrl: string;
	embedUrl: string;
}

export interface SketchfabTag {
	name: string;
	slug: string;
	uri: string;
}

export interface SketchfabCategory {
	name: string;
	slug: string;
	uri: string;
}

export interface SketchfabUser {
	uid: string;
	username: string;
	displayName: string;
	profileUrl: string;
	avatar?: SketchfabAvatar;
}

export interface SketchfabAvatar {
	uri: string;
	images: SketchfabImage[];
}

export interface SketchfabThumbnails {
	images: SketchfabImage[];
}

export interface SketchfabImage {
	url: string;
	width: number;
	height: number;
	size?: number;
}

export interface SketchfabLicense {
	uid: string;
	label: string;
	slug: string;
	url: string;
	requirements: {
		attribution: boolean;
		nonCommercial: boolean;
		noDerivatives: boolean;
		shareAlike: boolean;
	};
}

export interface SketchfabSearchResponse {
	results: SketchfabModel[];
	cursors: {
		next?: string;
		previous?: string;
	};
}

export interface SketchfabDownloadResponse {
	gltf?: {
		url: string;
		size: number;
		expires: number;
	};
	glb?: {
		url: string;
		size: number;
		expires: number;
	};
	usdz?: {
		url: string;
		size: number;
		expires: number;
	};
}

export interface SketchfabSearchOptions {
	query?: string;
	categories?: string[];
	tags?: string[];
	downloadable?: boolean;
	animated?: boolean;
	staffpicked?: boolean;
	minFaceCount?: number;
	maxFaceCount?: number;
	sortBy?: 'relevance' | 'likeCount' | 'viewCount' | 'publishedAt';
	cursor?: string;
	count?: number;
}
