/**
 * Base Adapter Class
 *
 * Adapters transform data between external formats (APIs, raw data)
 * and internal application formats.
 *
 * Extend this class to create specific adapters for different data types.
 *
 * @example
 * ```typescript
 * export class UserAdapter extends AdapterClass {
 *   constructor() {
 *     super('user');
 *   }
 *
 *   fromApi(apiUser: ApiUser): User {
 *     return { id: apiUser.user_id, name: apiUser.full_name };
 *   }
 *
 *   toApi(user: User): ApiUser {
 *     return { user_id: user.id, full_name: user.name };
 *   }
 * }
 *
 * export const userAdapter = new UserAdapter();
 * ```
 */
export abstract class AdapterClass {
	/**
	 * Unique identifier for this adapter
	 */
	protected readonly id: string;

	constructor(id: string) {
		this.id = id;
	}

	/**
	 * Get the adapter's identifier
	 */
	getId(): string {
		return this.id;
	}
}
