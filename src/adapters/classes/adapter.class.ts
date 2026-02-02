/**
 * Base Adapter Class
 *
 * Adapters transform data between external formats (APIs, raw data) and internal
 * application formats. All data transformation logic should live in adapters,
 * not in components or services.
 *
 * @example
 * ```typescript
 * // Create a concrete adapter for OMDB API
 * class OMDBAdapter extends AdapterClass<OMDBDetailedResult, Movie> {
 *   constructor() { super('omdb'); }
 *
 *   fromApi(apiData: OMDBDetailedResult): Movie {
 *     return {
 *       id: apiData.imdbID,
 *       title: apiData.Title,
 *       year: parseInt(apiData.Year),
 *       // ... transform other fields
 *     };
 *   }
 *
 *   toDisplayFormat(movie: Movie): string {
 *     return `${movie.title} (${movie.year})`;
 *   }
 * }
 *
 * export const omdbAdapter = new OMDBAdapter();
 * ```
 *
 * @template TApi - The external/API data type
 * @template TInternal - The internal application data type
 */
export abstract class AdapterClass<TApi = unknown, TInternal = unknown> {
	/** Unique identifier for this adapter */
	id: string;

	constructor(name: string) {
		this.id = `adapter:${name}`;
	}

	/**
	 * Transform a single API response to internal format.
	 * This is the primary transformation method that must be implemented.
	 *
	 * @param apiData - The raw data from the external API
	 * @returns The transformed internal data
	 */
	abstract fromApi(apiData: TApi): TInternal;

	/**
	 * Transform internal data to API format (for sending data back to API).
	 * Optional - only implement if needed for write operations.
	 *
	 * @param internalData - The internal application data
	 * @returns Partial API format (may not include all fields)
	 */
	toApi?(internalData: TInternal): Partial<TApi>;

	/**
	 * Convert internal data to a human-readable display string.
	 * Useful for UI rendering, logging, and debugging.
	 *
	 * @param data - The internal application data
	 * @returns A human-readable string representation
	 */
	abstract toDisplayFormat(data: TInternal): string;

	/**
	 * Transform an array of API responses to internal format.
	 * Default implementation maps over the array using fromApi.
	 *
	 * @param apiDataArray - Array of raw data from the external API
	 * @returns Array of transformed internal data
	 */
	fromApiMany(apiDataArray: TApi[]): TInternal[] {
		return apiDataArray.map((item) => this.fromApi(item));
	}

	/**
	 * Safely transform API data, returning null on error.
	 * Useful when data quality is uncertain.
	 *
	 * @param apiData - The raw data from the external API
	 * @returns The transformed internal data, or null if transformation failed
	 */
	safeFromApi(apiData: TApi): TInternal | null {
		try {
			return this.fromApi(apiData);
		} catch (error) {
			console.error(`[${this.id}] Transform error:`, error);
			return null;
		}
	}

	/**
	 * Safely transform an array of API responses, filtering out failed transformations.
	 *
	 * @param apiDataArray - Array of raw data from the external API
	 * @returns Array of successfully transformed internal data
	 */
	safeFromApiMany(apiDataArray: TApi[]): TInternal[] {
		return apiDataArray
			.map((item) => this.safeFromApi(item))
			.filter((item): item is TInternal => item !== null);
	}
}

/**
 * Simple non-generic adapter for backward compatibility.
 * Use this when you don't need type-safe transformations.
 *
 * @deprecated Use AdapterClass<TApi, TInternal> with proper types instead
 */
export class SimpleAdapterClass {
	id: string;

	constructor(name: string) {
		this.id = `adapter:${name}`;
	}
}
