import type {
	WikipediaSearchResult,
	WikipediaSearchResponse,
	WikidataResponse,
	WikidataEntity,
	WikidataItem,
	WikidataProperty,
	WikidataClaim
} from '$types/wikidata.type';
import { WIKIDATA_PROPERTIES } from '$types/wikidata.type';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/**
 * Search Wikipedia articles by query
 */
export async function searchWikipedia(
	query: string,
	limit: number = 10
): Promise<WikipediaSearchResult[]> {
	if (!query.trim()) return [];

	const params = new URLSearchParams({
		action: 'query',
		list: 'search',
		srsearch: query,
		srlimit: String(limit),
		format: 'json',
		origin: '*'
	});

	const response = await fetch(`${WIKIPEDIA_API}?${params}`);
	if (!response.ok) {
		throw new Error(`Wikipedia search failed: ${response.statusText}`);
	}

	const data: WikipediaSearchResponse = await response.json();
	return data.query?.search || [];
}

/**
 * Get Wikidata entity ID for a Wikipedia article title
 */
export async function getWikidataEntityId(wikipediaTitle: string): Promise<string | null> {
	const params = new URLSearchParams({
		action: 'query',
		titles: wikipediaTitle,
		prop: 'pageprops',
		ppprop: 'wikibase_item',
		format: 'json',
		origin: '*'
	});

	const response = await fetch(`${WIKIPEDIA_API}?${params}`);
	if (!response.ok) {
		throw new Error(`Failed to get Wikidata ID: ${response.statusText}`);
	}

	const data = await response.json();
	const pages = data.query?.pages;
	if (!pages) return null;

	const pageId = Object.keys(pages)[0];
	return pages[pageId]?.pageprops?.wikibase_item || null;
}

/**
 * Get Wikidata entity by ID
 */
export async function getWikidataEntity(entityId: string): Promise<WikidataEntity | null> {
	const params = new URLSearchParams({
		action: 'wbgetentities',
		ids: entityId,
		props: 'labels|descriptions|claims',
		languages: 'en',
		format: 'json',
		origin: '*'
	});

	const response = await fetch(`${WIKIDATA_API}?${params}`);
	if (!response.ok) {
		throw new Error(`Failed to get Wikidata entity: ${response.statusText}`);
	}

	const data: WikidataResponse = await response.json();
	return data.entities?.[entityId] || null;
}

/**
 * Get property labels for a list of property IDs
 * Batches requests in chunks of 50 (Wikidata API limit)
 */
async function getPropertyLabels(propertyIds: string[]): Promise<Record<string, string>> {
	if (propertyIds.length === 0) return {};

	const labels: Record<string, string> = {};
	const BATCH_SIZE = 50;

	// Split into chunks of 50
	const chunks: string[][] = [];
	for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
		chunks.push(propertyIds.slice(i, i + BATCH_SIZE));
	}

	// Fetch all chunks in parallel
	const results = await Promise.all(
		chunks.map(async (chunk) => {
			const params = new URLSearchParams({
				action: 'wbgetentities',
				ids: chunk.join('|'),
				props: 'labels',
				languages: 'en',
				format: 'json',
				origin: '*'
			});

			try {
				const response = await fetch(`${WIKIDATA_API}?${params}`);
				if (!response.ok) return {};

				const data: WikidataResponse = await response.json();
				const chunkLabels: Record<string, string> = {};

				for (const [id, entity] of Object.entries(data.entities || {})) {
					chunkLabels[id] = entity.labels?.en?.value || id;
				}

				return chunkLabels;
			} catch {
				return {};
			}
		})
	);

	// Merge all results
	for (const result of results) {
		Object.assign(labels, result);
	}

	return labels;
}

/**
 * Get entity label by ID
 */
async function getEntityLabel(entityId: string): Promise<string> {
	const params = new URLSearchParams({
		action: 'wbgetentities',
		ids: entityId,
		props: 'labels',
		languages: 'en',
		format: 'json',
		origin: '*'
	});

	const response = await fetch(`${WIKIDATA_API}?${params}`);
	if (!response.ok) return entityId;

	const data: WikidataResponse = await response.json();
	return data.entities?.[entityId]?.labels?.en?.value || entityId;
}

/**
 * Parse a claim value to a displayable string
 */
async function parseClaimValue(
	claim: WikidataClaim
): Promise<{ value: string; type: WikidataProperty['valueType'] }> {
	const datavalue = claim.mainsnak.datavalue;
	const datatype = claim.mainsnak.datatype;

	if (!datavalue) {
		return { value: 'No value', type: 'unknown' };
	}

	// Check datatype first for commonsMedia (images)
	if (datatype === 'commonsMedia') {
		return { value: datavalue.value as string, type: 'image' };
	}

	switch (datavalue.type) {
		case 'string':
			return { value: datavalue.value as string, type: 'string' };

		case 'wikibase-entityid': {
			const entityValue = datavalue.value as { id: string; 'entity-type': string };
			const label = await getEntityLabel(entityValue.id);
			return { value: label, type: 'entity' };
		}

		case 'time': {
			const timeValue = datavalue.value as { time: string; precision: number };
			// Parse ISO-like time format: +1999-03-31T00:00:00Z
			const timeStr = timeValue.time.replace(/^\+/, '');
			const date = new Date(timeStr);
			if (!isNaN(date.getTime())) {
				// Format based on precision (11 = day, 10 = month, 9 = year)
				if (timeValue.precision >= 11) {
					return { value: date.toLocaleDateString(), type: 'time' };
				} else if (timeValue.precision === 10) {
					return {
						value: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }),
						type: 'time'
					};
				} else {
					return { value: date.getFullYear().toString(), type: 'time' };
				}
			}
			return { value: timeStr, type: 'time' };
		}

		case 'quantity': {
			const quantityValue = datavalue.value as { amount: string; unit: string };
			let amount = quantityValue.amount.replace(/^\+/, '');
			// If unit is not "1", try to get unit label
			if (quantityValue.unit !== '1' && quantityValue.unit.includes('entity/Q')) {
				const unitId = quantityValue.unit.split('/').pop() || '';
				const unitLabel = await getEntityLabel(unitId);
				amount = `${amount} ${unitLabel}`;
			}
			return { value: amount, type: 'quantity' };
		}

		case 'monolingualtext': {
			const textValue = datavalue.value as { text: string; language: string };
			return { value: textValue.text, type: 'string' };
		}

		default:
			return { value: JSON.stringify(datavalue.value), type: 'unknown' };
	}
}

/**
 * Get Commons image URL from filename via local proxy
 * Uses a server-side proxy to avoid CORS/CSP issues in Tauri
 */
export function getCommonsImageUrl(filename: string, width: number = 300): string {
	const encodedFilename = encodeURIComponent(filename);
	return `/api/commons/proxy?filename=${encodedFilename}&width=${width}`;
}

/**
 * Get full Wikidata item with parsed properties for a Wikipedia article
 */
export async function getWikidataForArticle(wikipediaTitle: string): Promise<WikidataItem | null> {
	// Get entity ID
	const entityId = await getWikidataEntityId(wikipediaTitle);
	if (!entityId) return null;

	// Get entity data
	const entity = await getWikidataEntity(entityId);
	if (!entity) return null;

	// Get property labels
	const propertyIds = Object.keys(entity.claims);
	const propertyLabels = await getPropertyLabels(propertyIds);

	// Parse claims to properties
	const properties: WikidataProperty[] = [];

	for (const [propId, claims] of Object.entries(entity.claims)) {
		// Only take the first (preferred) claim for each property
		const claim = claims.find((c) => c.rank === 'preferred') || claims[0];
		if (!claim) continue;

		const { value, type } = await parseClaimValue(claim);

		properties.push({
			id: propId,
			label: propertyLabels[propId] || propId,
			value,
			valueType: type
		});
	}

	// Sort properties - put common ones first
	const priorityProps = Object.values(WIKIDATA_PROPERTIES);
	properties.sort((a, b) => {
		const aIndex = priorityProps.indexOf(a.id as any);
		const bIndex = priorityProps.indexOf(b.id as any);
		if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
		if (aIndex !== -1) return -1;
		if (bIndex !== -1) return 1;
		return a.label.localeCompare(b.label);
	});

	// Find image
	const imageProperty = properties.find(
		(p) =>
			p.id === WIKIDATA_PROPERTIES.IMAGE ||
			p.id === WIKIDATA_PROPERTIES.POSTER ||
			p.id === WIKIDATA_PROPERTIES.LOGO_IMAGE
	);

	return {
		entityId,
		wikipediaTitle,
		label: entity.labels?.en?.value || wikipediaTitle,
		description: entity.descriptions?.en?.value || '',
		properties,
		imageUrl: imageProperty?.value
	};
}

/**
 * Get specific properties from Wikidata entity
 */
export async function getWikidataProperties(
	wikipediaTitle: string,
	propertyIds: string[]
): Promise<Record<string, string>> {
	const entityId = await getWikidataEntityId(wikipediaTitle);
	if (!entityId) return {};

	const entity = await getWikidataEntity(entityId);
	if (!entity) return {};

	const result: Record<string, string> = {};

	for (const propId of propertyIds) {
		const claims = entity.claims[propId];
		if (!claims || claims.length === 0) continue;

		const claim = claims.find((c) => c.rank === 'preferred') || claims[0];
		const { value } = await parseClaimValue(claim);
		result[propId] = value;
	}

	return result;
}
