/**
 * Nature Types
 *
 * Internal types for species, observations, and natural history content.
 * These are the normalized internal representations used throughout the app.
 */

/**
 * Species/taxon representation (normalized from iNaturalist, etc.)
 */
export interface Species {
	id: string;
	scientificName: string;
	commonName?: string;
	rank: TaxonomicRank;
	parentId?: string;
	ancestorIds?: string[];
	observationCount: number;
	isActive?: boolean;
	iconicTaxonName?: string;
	defaultPhoto?: string;
	wikipedia?: {
		url?: string;
		summary?: string;
	};
	inatId?: number; // iNaturalist ID
}

/**
 * Taxonomic rank enumeration
 */
export type TaxonomicRank =
	| 'kingdom'
	| 'phylum'
	| 'subphylum'
	| 'superclass'
	| 'class'
	| 'subclass'
	| 'infraclass'
	| 'superorder'
	| 'order'
	| 'suborder'
	| 'infraorder'
	| 'superfamily'
	| 'epifamily'
	| 'family'
	| 'subfamily'
	| 'supertribe'
	| 'tribe'
	| 'subtribe'
	| 'genus'
	| 'genushybrid'
	| 'species'
	| 'hybrid'
	| 'subspecies'
	| 'variety'
	| 'form'
	| 'infrahybrid';

/**
 * Nature observation representation
 */
export interface NatureObservation {
	id: string;
	speciesId?: string;
	speciesGuess?: string;
	observedAt?: string; // ISO date
	location?: {
		latitude: number;
		longitude: number;
		placeGuess?: string;
		country?: string;
		state?: string;
	};
	qualityGrade?: 'casual' | 'needs_id' | 'research';
	photos: NaturePhoto[];
	userId?: string;
	userName?: string;
	inatId?: number;
}

/**
 * Nature photo representation
 */
export interface NaturePhoto {
	id: string;
	url: string;
	squareUrl?: string;
	smallUrl?: string;
	mediumUrl?: string;
	largeUrl?: string;
	originalUrl?: string;
	attribution?: string;
	licenseCode?: string;
}

/**
 * Taxonomic ancestor representation
 */
export interface TaxonomicAncestor {
	id: string;
	rank: TaxonomicRank;
	name: string;
	commonName?: string;
	iconicTaxonName?: string;
}

/**
 * Conservation status representation
 */
export interface ConservationStatus {
	status: string; // e.g., 'LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'
	statusName: string; // e.g., 'Least Concern', 'Vulnerable'
	iucnRedListId?: string;
	authority?: string;
	description?: string;
}

/**
 * Get conservation status label from code
 */
export function getConservationStatusLabel(code: string): string {
	const labels: Record<string, string> = {
		LC: 'Least Concern',
		NT: 'Near Threatened',
		VU: 'Vulnerable',
		EN: 'Endangered',
		CR: 'Critically Endangered',
		EW: 'Extinct in the Wild',
		EX: 'Extinct',
		DD: 'Data Deficient',
		NE: 'Not Evaluated'
	};
	return labels[code] || code;
}
