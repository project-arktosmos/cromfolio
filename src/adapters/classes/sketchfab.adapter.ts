/**
 * Sketchfab Adapter
 *
 * Transforms Sketchfab API responses to internal Model3D type.
 * Sketchfab is a platform for publishing, sharing, and discovering 3D content.
 */

import { AdapterClass } from './adapter.class';
import type {
	Model3D,
	Model3DArchive,
	Model3DCollection,
	Model3DLicenseType
} from '$types/model3d.type';

// ============================================================================
// Sketchfab API Types
// ============================================================================

/**
 * Sketchfab user/author object
 */
export interface SFUser {
	uid: string;
	username: string;
	displayName?: string;
	profileUrl?: string;
	avatar?: {
		url?: string;
		images?: Array<{
			url: string;
			width: number;
			height: number;
		}>;
	};
}

/**
 * Sketchfab license object
 */
export interface SFLicense {
	slug: string;
	label: string;
	fullName?: string;
	url?: string;
	requirements?: {
		attribution?: boolean;
		attributionUrl?: string;
		sharealike?: boolean;
		noncommercial?: boolean;
	};
}

/**
 * Sketchfab thumbnail object
 */
export interface SFThumbnail {
	url: string;
	uid?: string;
	width: number;
	height: number;
	size?: number;
}

/**
 * Sketchfab model/asset result
 */
export interface SFModelResult {
	uid: string;
	name: string;
	description?: string;
	thumbnails?: {
		images?: SFThumbnail[];
	};
	embedUrl?: string;
	viewerUrl?: string;
	user?: SFUser;
	license?: SFLicense;
	tags?: Array<{ name: string; slug: string }>;
	categories?: Array<{ name: string; slug: string }>;
	createdAt?: string;
	publishedAt?: string;
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
	archives?: {
		gltf?: SFArchive;
		source?: SFArchive;
		usdz?: SFArchive;
	};
}

/**
 * Sketchfab archive/download format
 */
export interface SFArchive {
	size?: number;
	textured?: boolean;
	faceCount?: number;
	vertexCount?: number;
	url?: string;
}

/**
 * Sketchfab collection result
 */
export interface SFCollectionResult {
	uid: string;
	name: string;
	description?: string;
	modelCount: number;
	thumbnails?: {
		images?: SFThumbnail[];
	};
	user?: SFUser;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Sketchfab search results wrapper
 */
export interface SFSearchResults {
	results: SFModelResult[];
	cursors?: {
		next?: string;
		previous?: string;
	};
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class SketchfabAdapter extends AdapterClass<SFModelResult, Model3D> {
	constructor() {
		super('sketchfab');
	}

	/**
	 * Transform Sketchfab model to internal Model3D format
	 */
	fromApi(apiData: SFModelResult): Model3D {
		return {
			id: apiData.uid,
			name: apiData.name,
			description: apiData.description,
			thumbnailUrl: this.getBestThumbnail(apiData.thumbnails?.images),
			embedUrl: apiData.embedUrl || this.buildEmbedUrl(apiData.uid),
			viewerUrl: apiData.viewerUrl || this.buildViewerUrl(apiData.uid),
			downloadUrl: apiData.isDownloadable ? this.buildDownloadUrl(apiData.uid) : undefined,
			author: apiData.user
				? {
						id: apiData.user.uid,
						username: apiData.user.username,
						displayName: apiData.user.displayName,
						avatar: this.getAvatarUrl(apiData.user.avatar),
						profileUrl: apiData.user.profileUrl
					}
				: undefined,
			license: apiData.license
				? {
						slug: apiData.license.slug,
						label: apiData.license.label,
						fullName: apiData.license.fullName,
						url: apiData.license.url
					}
				: undefined,
			tags: apiData.tags?.map((t) => t.name),
			categories: apiData.categories?.map((c) => c.name),
			createdAt: apiData.createdAt,
			publishedAt: apiData.publishedAt,
			viewCount: apiData.viewCount,
			likeCount: apiData.likeCount,
			commentCount: apiData.commentCount,
			downloadCount: apiData.downloadCount,
			faceCount: apiData.faceCount,
			vertexCount: apiData.vertexCount,
			textureCount: apiData.textureCount,
			isAnimated: apiData.isAnimated,
			hasSound: apiData.hasSound,
			isDownloadable: apiData.isDownloadable,
			archives: this.transformArchives(apiData.archives),
			sketchfabId: apiData.uid
		};
	}

	/**
	 * Transform Sketchfab collection to internal Model3DCollection format
	 */
	fromCollection(apiData: SFCollectionResult): Model3DCollection {
		return {
			id: apiData.uid,
			name: apiData.name,
			description: apiData.description,
			modelCount: apiData.modelCount,
			thumbnailUrl: this.getBestThumbnail(apiData.thumbnails?.images),
			author: apiData.user
				? {
						id: apiData.user.uid,
						username: apiData.user.username,
						displayName: apiData.user.displayName
					}
				: undefined,
			createdAt: apiData.createdAt,
			updatedAt: apiData.updatedAt
		};
	}

	/**
	 * Format model for display
	 */
	toDisplayFormat(model: Model3D): string {
		const author = model.author?.displayName || model.author?.username;
		if (author) {
			return `${model.name} by ${author}`;
		}
		return model.name;
	}

	// ========================================================================
	// License Helpers
	// ========================================================================

	/**
	 * Convert Sketchfab license slug to internal license type
	 */
	toLicenseType(license?: SFLicense): Model3DLicenseType {
		if (!license) {
			return 'other';
		}

		const slugMap: Record<string, Model3DLicenseType> = {
			cc0: 'cc0',
			'cc-by': 'cc-by',
			'cc-by-4.0': 'cc-by',
			'cc-by-sa': 'cc-by-sa',
			'cc-by-sa-4.0': 'cc-by-sa',
			'cc-by-nc': 'cc-by-nc',
			'cc-by-nc-4.0': 'cc-by-nc',
			'cc-by-nc-sa': 'cc-by-nc-sa',
			'cc-by-nc-sa-4.0': 'cc-by-nc-sa',
			'cc-by-nd': 'cc-by-nd',
			'cc-by-nd-4.0': 'cc-by-nd',
			'cc-by-nc-nd': 'cc-by-nc-nd',
			'cc-by-nc-nd-4.0': 'cc-by-nc-nd',
			standard: 'standard',
			editorial: 'editorial'
		};

		return slugMap[license.slug] || 'other';
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromCollectionMany(apiDataArray: SFCollectionResult[]): Model3DCollection[] {
		return apiDataArray.map((item) => this.fromCollection(item));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private getBestThumbnail(thumbnails?: SFThumbnail[]): string | undefined {
		if (!thumbnails || thumbnails.length === 0) {
			return undefined;
		}

		// Sort by size (prefer larger images) and return the best one
		const sorted = [...thumbnails].sort((a, b) => {
			const sizeA = a.width * a.height;
			const sizeB = b.width * b.height;
			return sizeB - sizeA;
		});

		// Find a reasonably sized thumbnail (not too huge, not too small)
		const preferred = sorted.find((t) => t.width >= 256 && t.width <= 1024);
		return preferred?.url || sorted[0]?.url;
	}

	private getAvatarUrl(avatar?: SFUser['avatar']): string | undefined {
		if (!avatar) {
			return undefined;
		}
		if (avatar.url) {
			return avatar.url;
		}
		if (avatar.images && avatar.images.length > 0) {
			return avatar.images[0].url;
		}
		return undefined;
	}

	private buildEmbedUrl(uid: string): string {
		return `https://sketchfab.com/models/${uid}/embed`;
	}

	private buildViewerUrl(uid: string): string {
		return `https://sketchfab.com/3d-models/${uid}`;
	}

	private buildDownloadUrl(uid: string): string {
		return `https://sketchfab.com/models/${uid}/download`;
	}

	private transformArchives(archives?: SFModelResult['archives']): Model3DArchive[] | undefined {
		if (!archives) {
			return undefined;
		}

		const result: Model3DArchive[] = [];

		if (archives.gltf) {
			result.push({
				format: 'gltf',
				size: archives.gltf.size,
				textured: archives.gltf.textured,
				url: archives.gltf.url
			});
		}

		if (archives.usdz) {
			result.push({
				format: 'usdz',
				size: archives.usdz.size,
				textured: archives.usdz.textured,
				url: archives.usdz.url
			});
		}

		if (archives.source) {
			result.push({
				format: 'source',
				size: archives.source.size,
				textured: archives.source.textured,
				url: archives.source.url
			});
		}

		return result.length > 0 ? result : undefined;
	}
}

export const sketchfabAdapter = new SketchfabAdapter();
