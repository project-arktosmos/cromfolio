/**
 * iNaturalist Adapter
 *
 * Transforms iNaturalist API responses to internal Species and Observation types.
 * iNaturalist is a citizen science platform for biodiversity observation.
 */

import { AdapterClass } from './adapter.class';
import type {
	Species,
	NatureObservation,
	NaturePhoto,
	TaxonomicAncestor,
	TaxonomicRank
} from '$types/nature.type';

// ============================================================================
// iNaturalist API Types
// ============================================================================

/**
 * iNaturalist photo object
 */
export interface INatPhoto {
	id: number;
	url: string;
	square_url?: string;
	small_url?: string;
	medium_url?: string;
	large_url?: string;
	original_url?: string;
	attribution?: string;
	license_code?: string;
}

/**
 * iNaturalist taxon (species) result
 */
export interface INatTaxonResult {
	id: number;
	name: string;
	rank: string;
	rank_level?: number;
	preferred_common_name?: string;
	english_common_name?: string;
	is_active?: boolean;
	iconic_taxon_name?: string;
	parent_id?: number;
	ancestor_ids?: number[];
	observations_count?: number;
	default_photo?: INatPhoto;
	taxon_photos?: Array<{ photo: INatPhoto }>;
	wikipedia_url?: string;
	wikipedia_summary?: string;
	ancestors?: INatTaxonResult[];
}

/**
 * iNaturalist location object
 */
export interface INatLocation {
	latitude: number;
	longitude: number;
	place_guess?: string;
}

/**
 * iNaturalist observation result
 */
export interface INatObservationResult {
	id: number;
	uuid?: string;
	taxon?: INatTaxonResult;
	species_guess?: string;
	observed_on?: string;
	observed_on_string?: string;
	time_observed_at?: string;
	location?: string; // "lat,lng" format
	place_guess?: string;
	latitude?: number;
	longitude?: number;
	positional_accuracy?: number;
	quality_grade?: string;
	photos?: INatPhoto[];
	user?: {
		id: number;
		login: string;
		name?: string;
		icon_url?: string;
	};
	created_at?: string;
	updated_at?: string;
}

/**
 * iNaturalist search result wrapper
 */
export interface INatSearchResult {
	total_results: number;
	page: number;
	per_page: number;
	results: INatTaxonResult[] | INatObservationResult[];
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class INaturalistAdapter extends AdapterClass<INatTaxonResult, Species> {
	constructor() {
		super('inaturalist');
	}

	/**
	 * Transform iNaturalist taxon to internal Species format
	 */
	fromApi(apiData: INatTaxonResult): Species {
		return {
			id: String(apiData.id),
			scientificName: apiData.name,
			commonName: apiData.preferred_common_name || apiData.english_common_name,
			rank: this.normalizeRank(apiData.rank),
			parentId: apiData.parent_id ? String(apiData.parent_id) : undefined,
			ancestorIds: apiData.ancestor_ids?.map((id) => String(id)),
			observationCount: apiData.observations_count || 0,
			isActive: apiData.is_active,
			iconicTaxonName: apiData.iconic_taxon_name,
			defaultPhoto: this.extractPhotoUrl(apiData.default_photo),
			wikipedia: apiData.wikipedia_url
				? {
						url: apiData.wikipedia_url,
						summary: apiData.wikipedia_summary
					}
				: undefined,
			inatId: apiData.id
		};
	}

	/**
	 * Transform iNaturalist observation to internal NatureObservation format
	 */
	fromObservation(apiData: INatObservationResult): NatureObservation {
		const coords = this.parseLocation(apiData);

		return {
			id: apiData.uuid || String(apiData.id),
			speciesId: apiData.taxon ? String(apiData.taxon.id) : undefined,
			speciesGuess: apiData.species_guess,
			observedAt: apiData.observed_on || apiData.time_observed_at,
			location: coords
				? {
						latitude: coords.latitude,
						longitude: coords.longitude,
						placeGuess: apiData.place_guess
					}
				: undefined,
			qualityGrade: this.normalizeQualityGrade(apiData.quality_grade),
			photos: apiData.photos?.map((p) => this.transformPhoto(p)) || [],
			userId: apiData.user ? String(apiData.user.id) : undefined,
			userName: apiData.user?.name || apiData.user?.login,
			inatId: apiData.id
		};
	}

	/**
	 * Transform iNaturalist photo to internal NaturePhoto format
	 */
	fromPhoto(apiData: INatPhoto): NaturePhoto {
		return this.transformPhoto(apiData);
	}

	/**
	 * Transform taxon ancestor to internal TaxonomicAncestor format
	 */
	fromAncestor(apiData: INatTaxonResult): TaxonomicAncestor {
		return {
			id: String(apiData.id),
			rank: this.normalizeRank(apiData.rank),
			name: apiData.name,
			commonName: apiData.preferred_common_name || apiData.english_common_name,
			iconicTaxonName: apiData.iconic_taxon_name
		};
	}

	/**
	 * Format species for display
	 */
	toDisplayFormat(species: Species): string {
		if (species.commonName) {
			return `${species.commonName} (${species.scientificName})`;
		}
		return species.scientificName;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromObservationMany(apiDataArray: INatObservationResult[]): NatureObservation[] {
		return apiDataArray.map((item) => this.fromObservation(item));
	}

	fromPhotoMany(apiDataArray: INatPhoto[]): NaturePhoto[] {
		return apiDataArray.map((item) => this.fromPhoto(item));
	}

	fromAncestorMany(apiDataArray: INatTaxonResult[]): TaxonomicAncestor[] {
		return apiDataArray.map((item) => this.fromAncestor(item));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private transformPhoto(photo: INatPhoto): NaturePhoto {
		return {
			id: String(photo.id),
			url: photo.url,
			squareUrl: photo.square_url,
			smallUrl: photo.small_url,
			mediumUrl: photo.medium_url,
			largeUrl: photo.large_url,
			originalUrl: photo.original_url,
			attribution: photo.attribution,
			licenseCode: photo.license_code
		};
	}

	private extractPhotoUrl(photo?: INatPhoto): string | undefined {
		if (!photo) {
			return undefined;
		}
		// Prefer higher resolution images
		return photo.medium_url || photo.small_url || photo.url;
	}

	private parseLocation(
		data: INatObservationResult
	): { latitude: number; longitude: number } | null {
		// Try explicit lat/lng first
		if (data.latitude != null && data.longitude != null) {
			return { latitude: data.latitude, longitude: data.longitude };
		}

		// Try parsing location string "lat,lng"
		if (data.location) {
			const parts = data.location.split(',').map((p) => parseFloat(p.trim()));
			if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
				return { latitude: parts[0], longitude: parts[1] };
			}
		}

		return null;
	}

	private normalizeRank(rank: string): TaxonomicRank {
		const rankLower = rank.toLowerCase().replace(/\s+/g, '');
		const validRanks: TaxonomicRank[] = [
			'kingdom',
			'phylum',
			'subphylum',
			'superclass',
			'class',
			'subclass',
			'infraclass',
			'superorder',
			'order',
			'suborder',
			'infraorder',
			'superfamily',
			'epifamily',
			'family',
			'subfamily',
			'supertribe',
			'tribe',
			'subtribe',
			'genus',
			'genushybrid',
			'species',
			'hybrid',
			'subspecies',
			'variety',
			'form',
			'infrahybrid'
		];

		if (validRanks.includes(rankLower as TaxonomicRank)) {
			return rankLower as TaxonomicRank;
		}

		// Default to species if unknown
		return 'species';
	}

	private normalizeQualityGrade(grade?: string): NatureObservation['qualityGrade'] {
		const gradeMap: Record<string, NatureObservation['qualityGrade']> = {
			casual: 'casual',
			needs_id: 'needs_id',
			research: 'research'
		};
		return gradeMap[grade || ''];
	}
}

export const inaturalistAdapter = new INaturalistAdapter();
