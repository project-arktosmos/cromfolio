/**
 * WikiData Adapter
 *
 * Transforms WikiData API responses to internal types.
 * WikiData is a free knowledge base with structured data.
 */

import { AdapterClass } from './adapter.class';

// ============================================================================
// WikiData API Types
// ============================================================================

/**
 * WikiData label/description in multiple languages
 */
export interface WDLocalizedValue {
	language: string;
	value: string;
}

/**
 * WikiData sitelink (Wikipedia, etc.)
 */
export interface WDSitelink {
	site: string;
	title: string;
	url?: string;
	badges?: string[];
}

/**
 * WikiData claim/statement value types
 */
export interface WDValue {
	'entity-type'?: string;
	'numeric-id'?: number;
	id?: string;
	time?: string;
	precision?: number;
	calendarmodel?: string;
	amount?: string;
	unit?: string;
	latitude?: number;
	longitude?: number;
	altitude?: number | null;
	precision_geo?: number;
	globe?: string;
	text?: string;
	language?: string;
}

/**
 * WikiData data value wrapper
 */
export interface WDDataValue {
	value: WDValue | string;
	type:
		| 'wikibase-entityid'
		| 'string'
		| 'time'
		| 'quantity'
		| 'globecoordinate'
		| 'monolingualtext';
}

/**
 * WikiData snak (statement part)
 */
export interface WDSnak {
	snaktype: 'value' | 'novalue' | 'somevalue';
	property: string;
	hash?: string;
	datavalue?: WDDataValue;
	datatype?: string;
}

/**
 * WikiData claim/statement
 */
export interface WDClaim {
	mainsnak: WDSnak;
	type: string;
	id: string;
	rank: 'normal' | 'preferred' | 'deprecated';
	qualifiers?: Record<string, WDSnak[]>;
	references?: Array<{
		hash: string;
		snaks: Record<string, WDSnak[]>;
	}>;
}

/**
 * WikiData entity result
 */
export interface WDEntityResult {
	type: 'item' | 'property';
	id: string;
	labels?: Record<string, WDLocalizedValue>;
	descriptions?: Record<string, WDLocalizedValue>;
	aliases?: Record<string, WDLocalizedValue[]>;
	claims?: Record<string, WDClaim[]>;
	sitelinks?: Record<string, WDSitelink>;
	modified?: string;
}

/**
 * WikiData search result
 */
export interface WDSearchResult {
	id: string;
	title: string;
	pageid: number;
	display: {
		label?: WDLocalizedValue;
		description?: WDLocalizedValue;
	};
	repository: string;
	url: string;
	concepturi: string;
	label?: string;
	description?: string;
	match: {
		type: string;
		language: string;
		text: string;
	};
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal WikiData item representation
 */
export interface WikiDataItem {
	id: string;
	label: string;
	description?: string;
	aliases: string[];
	wikipediaUrl?: string;
	imageUrl?: string;
	properties: Map<string, WikiDataPropertyValue[]>;
	modified?: string;
}

/**
 * Internal property value representation
 */
export interface WikiDataPropertyValue {
	type: 'entity' | 'string' | 'time' | 'quantity' | 'coordinate' | 'text';
	value: string;
	entityId?: string;
	numericValue?: number;
	coordinates?: { latitude: number; longitude: number };
	qualifiers?: Record<string, string>;
}

// ============================================================================
// Common WikiData Properties
// ============================================================================

export const WIKIDATA_PROPERTIES = {
	INSTANCE_OF: 'P31',
	SUBCLASS_OF: 'P279',
	IMAGE: 'P18',
	LOGO_IMAGE: 'P154',
	OFFICIAL_WEBSITE: 'P856',
	INCEPTION: 'P571',
	DISSOLVED: 'P576',
	COUNTRY: 'P17',
	LOCATED_IN: 'P131',
	COORDINATE_LOCATION: 'P625',
	IMDB_ID: 'P345',
	MUSICBRAINZ_ID: 'P434',
	SPOTIFY_ARTIST_ID: 'P1902',
	TWITTER_USERNAME: 'P2002',
	FACEBOOK_ID: 'P2013',
	INSTAGRAM_USERNAME: 'P2003'
} as const;

// ============================================================================
// Adapter Implementation
// ============================================================================

class WikiDataAdapter extends AdapterClass<WDEntityResult, WikiDataItem> {
	constructor() {
		super('wikidata');
	}

	/**
	 * Transform WikiData entity to internal WikiDataItem format
	 */
	fromApi(apiData: WDEntityResult, lang: string = 'en'): WikiDataItem {
		return {
			id: apiData.id,
			label: this.getLocalizedValue(apiData.labels, lang) || apiData.id,
			description: this.getLocalizedValue(apiData.descriptions, lang),
			aliases: this.getLocalizedAliases(apiData.aliases, lang),
			wikipediaUrl: this.getWikipediaUrl(apiData.sitelinks, lang),
			imageUrl: this.getImageUrl(apiData.claims),
			properties: this.transformClaims(apiData.claims),
			modified: apiData.modified
		};
	}

	/**
	 * Transform WikiData search result to internal WikiDataItem format (partial)
	 */
	fromSearchResult(result: WDSearchResult): WikiDataItem {
		return {
			id: result.id,
			label: result.display?.label?.value || result.label || result.id,
			description: result.display?.description?.value || result.description,
			aliases: [],
			properties: new Map()
		};
	}

	/**
	 * Format item for display
	 */
	toDisplayFormat(item: WikiDataItem): string {
		if (item.description) {
			return `${item.label} - ${item.description}`;
		}
		return item.label;
	}

	// ========================================================================
	// Property Access Helpers
	// ========================================================================

	/**
	 * Get string value for a property
	 */
	getPropertyString(item: WikiDataItem, propertyId: string): string | undefined {
		const values = item.properties.get(propertyId);
		if (!values || values.length === 0) {
			return undefined;
		}
		return values[0].value;
	}

	/**
	 * Get all string values for a property
	 */
	getPropertyStrings(item: WikiDataItem, propertyId: string): string[] {
		const values = item.properties.get(propertyId);
		if (!values) {
			return [];
		}
		return values.map((v) => v.value);
	}

	/**
	 * Get entity ID value for a property
	 */
	getPropertyEntityId(item: WikiDataItem, propertyId: string): string | undefined {
		const values = item.properties.get(propertyId);
		if (!values || values.length === 0) {
			return undefined;
		}
		return values[0].entityId;
	}

	/**
	 * Get coordinates for a property
	 */
	getPropertyCoordinates(
		item: WikiDataItem,
		propertyId: string
	): { latitude: number; longitude: number } | undefined {
		const values = item.properties.get(propertyId);
		if (!values || values.length === 0) {
			return undefined;
		}
		return values[0].coordinates;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromSearchResults(results: WDSearchResult[]): WikiDataItem[] {
		return results.map((r) => this.fromSearchResult(r));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private getLocalizedValue(
		values?: Record<string, WDLocalizedValue>,
		lang: string = 'en'
	): string | undefined {
		if (!values) {
			return undefined;
		}
		// Try requested language first, then English, then any available
		return values[lang]?.value || values['en']?.value || Object.values(values)[0]?.value;
	}

	private getLocalizedAliases(
		aliases?: Record<string, WDLocalizedValue[]>,
		lang: string = 'en'
	): string[] {
		if (!aliases) {
			return [];
		}
		const langAliases = aliases[lang] || aliases['en'] || [];
		return langAliases.map((a) => a.value);
	}

	private getWikipediaUrl(
		sitelinks?: Record<string, WDSitelink>,
		lang: string = 'en'
	): string | undefined {
		if (!sitelinks) {
			return undefined;
		}
		const wikiKey = `${lang}wiki`;
		const sitelink = sitelinks[wikiKey] || sitelinks['enwiki'];
		if (!sitelink) {
			return undefined;
		}
		if (sitelink.url) {
			return sitelink.url;
		}
		const wiki = sitelinks[wikiKey] ? lang : 'en';
		return `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(sitelink.title.replace(/ /g, '_'))}`;
	}

	private getImageUrl(claims?: Record<string, WDClaim[]>): string | undefined {
		if (!claims) {
			return undefined;
		}
		// Try P18 (image) first, then P154 (logo)
		const imageClaims = claims[WIKIDATA_PROPERTIES.IMAGE] || claims[WIKIDATA_PROPERTIES.LOGO_IMAGE];
		if (!imageClaims || imageClaims.length === 0) {
			return undefined;
		}

		const value = imageClaims[0].mainsnak.datavalue?.value;
		if (typeof value === 'string') {
			// Convert filename to Wikimedia Commons URL
			const filename = value.replace(/ /g, '_');
			return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
		}
		return undefined;
	}

	private transformClaims(
		claims?: Record<string, WDClaim[]>
	): Map<string, WikiDataPropertyValue[]> {
		const result = new Map<string, WikiDataPropertyValue[]>();

		if (!claims) {
			return result;
		}

		for (const [propertyId, claimList] of Object.entries(claims)) {
			const values: WikiDataPropertyValue[] = [];

			for (const claim of claimList) {
				const transformed = this.transformClaimValue(claim);
				if (transformed) {
					values.push(transformed);
				}
			}

			if (values.length > 0) {
				result.set(propertyId, values);
			}
		}

		return result;
	}

	private transformClaimValue(claim: WDClaim): WikiDataPropertyValue | null {
		const datavalue = claim.mainsnak.datavalue;
		if (!datavalue) {
			return null;
		}

		switch (datavalue.type) {
			case 'wikibase-entityid': {
				const v = datavalue.value as WDValue;
				const entityId =
					v.id || (v['entity-type'] === 'item' ? `Q${v['numeric-id']}` : `P${v['numeric-id']}`);
				return {
					type: 'entity',
					value: entityId,
					entityId
				};
			}

			case 'string':
				return {
					type: 'string',
					value: datavalue.value as string
				};

			case 'time': {
				const v = datavalue.value as WDValue;
				return {
					type: 'time',
					value: v.time || ''
				};
			}

			case 'quantity': {
				const v = datavalue.value as WDValue;
				const numValue = v.amount ? parseFloat(v.amount) : undefined;
				return {
					type: 'quantity',
					value: v.amount || '',
					numericValue: numValue
				};
			}

			case 'globecoordinate': {
				const v = datavalue.value as WDValue;
				return {
					type: 'coordinate',
					value: `${v.latitude},${v.longitude}`,
					coordinates:
						v.latitude != null && v.longitude != null
							? {
									latitude: v.latitude,
									longitude: v.longitude
								}
							: undefined
				};
			}

			case 'monolingualtext': {
				const v = datavalue.value as WDValue;
				return {
					type: 'text',
					value: v.text || ''
				};
			}

			default:
				return null;
		}
	}
}

export const wikidataAdapter = new WikiDataAdapter();
