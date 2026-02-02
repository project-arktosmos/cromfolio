/**
 * TypeScript Query Builder
 *
 * Builds parameterized SQL queries and executes them via Rust backend.
 * All parameters are bound (never interpolated) to prevent SQL injection.
 *
 * @example
 * ```typescript
 * import { db } from '$db/query-builder';
 *
 * // SELECT
 * const sources = await db.select<Source>({
 *   table: 'sources',
 *   columns: ['id', 'title', 'description'],
 *   where: [{ column: 'id', operator: '=', value: 'abc123' }]
 * });
 *
 * // INSERT
 * const newSource = await db.insert<Source>({
 *   table: 'sources',
 *   columns: ['id', 'title'],
 *   values: ['abc123', 'My Source']
 * });
 *
 * // UPDATE
 * await db.update({
 *   table: 'sources',
 *   set: { title: 'Updated Title' },
 *   where: [{ column: 'id', operator: '=', value: 'abc123' }]
 * });
 *
 * // DELETE
 * await db.delete({
 *   table: 'sources',
 *   where: [{ column: 'id', operator: '=', value: 'abc123' }]
 * });
 * ```
 */

import { invoke } from '@tauri-apps/api/core';
import type {
	SqlValue,
	SqlParams,
	QueryResult,
	SelectQuery,
	InsertQuery,
	BatchInsertQuery,
	UpdateQuery,
	DeleteQuery,
	WhereCondition,
	JoinClause,
	OrderByClause,
	QueryRequest
} from './query-builder.types';

/**
 * QueryBuilder class for constructing and executing parameterized SQL queries.
 *
 * This class provides a type-safe way to build SQL queries in TypeScript,
 * with all values passed as parameters to prevent SQL injection.
 */
export class QueryBuilder {
	private paramIndex: number = 1;
	private params: SqlParams = [];

	/**
	 * Reset parameter state for a new query
	 */
	private resetParams(): void {
		this.paramIndex = 1;
		this.params = [];
	}

	/**
	 * Add a parameter and return its placeholder
	 */
	private addParam(value: SqlValue): string {
		this.params.push(value);
		return `?${this.paramIndex++}`;
	}

	/**
	 * Build WHERE clause from conditions
	 */
	private buildWhere(conditions: WhereCondition[], logic: 'AND' | 'OR' = 'AND'): string {
		if (conditions.length === 0) return '';

		const clauses = conditions.map((cond) => {
			switch (cond.operator) {
				case 'IS NULL':
					return `${cond.column} IS NULL`;

				case 'IS NOT NULL':
					return `${cond.column} IS NOT NULL`;

				case 'IN':
				case 'NOT IN': {
					if (!Array.isArray(cond.value)) {
						throw new Error(`${cond.operator} requires an array value`);
					}
					const placeholders = cond.value.map((v) => this.addParam(v)).join(', ');
					return `${cond.column} ${cond.operator} (${placeholders})`;
				}

				case 'BETWEEN': {
					if (!cond.betweenValues || cond.betweenValues.length !== 2) {
						throw new Error('BETWEEN requires betweenValues array with exactly 2 elements');
					}
					const [min, max] = cond.betweenValues;
					return `${cond.column} BETWEEN ${this.addParam(min)} AND ${this.addParam(max)}`;
				}

				default:
					return `${cond.column} ${cond.operator} ${this.addParam(cond.value as SqlValue)}`;
			}
		});

		return `WHERE ${clauses.join(` ${logic} `)}`;
	}

	/**
	 * Build JOIN clauses
	 */
	private buildJoins(joins: JoinClause[]): string {
		return joins
			.map((join) => {
				const tableRef = join.alias ? `${join.table} AS ${join.alias}` : join.table;
				return `${join.type} JOIN ${tableRef} ON ${join.on.left} = ${join.on.right}`;
			})
			.join(' ');
	}

	/**
	 * Build ORDER BY clause
	 */
	private buildOrderBy(orderBy: OrderByClause[]): string {
		if (orderBy.length === 0) return '';

		const clauses = orderBy.map((o) => {
			let clause = `${o.column} ${o.direction}`;
			if (o.nulls) {
				clause += ` NULLS ${o.nulls}`;
			}
			return clause;
		});

		return `ORDER BY ${clauses.join(', ')}`;
	}

	/**
	 * Build GROUP BY clause
	 */
	private buildGroupBy(columns: string[]): string {
		if (columns.length === 0) return '';
		return `GROUP BY ${columns.join(', ')}`;
	}

	/**
	 * Build and execute a SELECT query
	 *
	 * @example
	 * ```typescript
	 * const users = await db.select<User>({
	 *   table: 'users',
	 *   columns: ['id', 'name', 'email'],
	 *   where: [{ column: 'active', operator: '=', value: true }],
	 *   orderBy: [{ column: 'name', direction: 'ASC' }],
	 *   limit: 10
	 * });
	 * ```
	 */
	async select<T>(query: SelectQuery): Promise<T[]> {
		this.resetParams();

		const distinct = query.distinct ? 'DISTINCT ' : '';
		const columns = query.columns.join(', ');
		const tableRef = query.alias ? `${query.table} AS ${query.alias}` : query.table;

		let sql = `SELECT ${distinct}${columns} FROM ${tableRef}`;

		// Joins
		if (query.joins && query.joins.length > 0) {
			sql += ` ${this.buildJoins(query.joins)}`;
		}

		// Where
		if (query.where && query.where.length > 0) {
			sql += ` ${this.buildWhere(query.where, query.whereLogic)}`;
		}

		// Group By
		if (query.groupBy && query.groupBy.length > 0) {
			sql += ` ${this.buildGroupBy(query.groupBy)}`;
		}

		// Having
		if (query.having && query.having.length > 0) {
			// Reset param indexing isn't needed, we continue from where we left off
			const havingClauses = query.having.map((cond) => {
				if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
					return `${cond.column} ${cond.operator}`;
				}
				return `${cond.column} ${cond.operator} ${this.addParam(cond.value as SqlValue)}`;
			});
			sql += ` HAVING ${havingClauses.join(' AND ')}`;
		}

		// Order By
		if (query.orderBy && query.orderBy.length > 0) {
			sql += ` ${this.buildOrderBy(query.orderBy)}`;
		}

		// Limit & Offset
		if (query.limit !== undefined) {
			sql += ` LIMIT ${this.addParam(query.limit)}`;
		}
		if (query.offset !== undefined) {
			sql += ` OFFSET ${this.addParam(query.offset)}`;
		}

		const result = await invoke<QueryResult<T>>('execute_query', {
			sql,
			params: this.params
		});

		return result.rows;
	}

	/**
	 * Build and execute an INSERT query
	 *
	 * @example
	 * ```typescript
	 * const newUser = await db.insert<User>({
	 *   table: 'users',
	 *   columns: ['id', 'name', 'email'],
	 *   values: ['123', 'John', 'john@example.com']
	 * });
	 * ```
	 */
	async insert<T>(query: InsertQuery): Promise<QueryResult<T>> {
		this.resetParams();

		const columns = query.columns.join(', ');
		const placeholders = query.values.map((v) => this.addParam(v)).join(', ');

		const conflict = query.conflictAction ? `OR ${query.conflictAction} ` : '';

		const sql = `INSERT ${conflict}INTO ${query.table} (${columns}) VALUES (${placeholders})`;

		return await invoke<QueryResult<T>>('execute_query', {
			sql,
			params: this.params
		});
	}

	/**
	 * Build and execute a batch INSERT query
	 *
	 * @example
	 * ```typescript
	 * await db.insertMany({
	 *   table: 'tags',
	 *   columns: ['id', 'key', 'value'],
	 *   rows: [
	 *     ['1', 'color', 'red'],
	 *     ['2', 'color', 'blue'],
	 *     ['3', 'size', 'large']
	 *   ]
	 * });
	 * ```
	 */
	async insertMany<T>(query: BatchInsertQuery): Promise<QueryResult<T>> {
		this.resetParams();

		const columns = query.columns.join(', ');
		const conflict = query.conflictAction ? `OR ${query.conflictAction} ` : '';

		const rowPlaceholders = query.rows.map((row) => {
			const placeholders = row.map((v) => this.addParam(v)).join(', ');
			return `(${placeholders})`;
		});

		const sql = `INSERT ${conflict}INTO ${query.table} (${columns}) VALUES ${rowPlaceholders.join(', ')}`;

		return await invoke<QueryResult<T>>('execute_query', {
			sql,
			params: this.params
		});
	}

	/**
	 * Build and execute an UPDATE query
	 *
	 * @example
	 * ```typescript
	 * await db.update({
	 *   table: 'users',
	 *   set: { name: 'Jane', email: 'jane@example.com' },
	 *   where: [{ column: 'id', operator: '=', value: '123' }]
	 * });
	 * ```
	 */
	async update<T>(query: UpdateQuery): Promise<QueryResult<T>> {
		this.resetParams();

		const setClauses = Object.entries(query.set)
			.map(([col, val]) => `${col} = ${this.addParam(val)}`)
			.join(', ');

		const whereClause = this.buildWhere(query.where, query.whereLogic);

		const sql = `UPDATE ${query.table} SET ${setClauses} ${whereClause}`;

		return await invoke<QueryResult<T>>('execute_query', {
			sql,
			params: this.params
		});
	}

	/**
	 * Build and execute a DELETE query
	 *
	 * @example
	 * ```typescript
	 * await db.delete({
	 *   table: 'users',
	 *   where: [{ column: 'id', operator: '=', value: '123' }]
	 * });
	 * ```
	 */
	async delete(query: DeleteQuery): Promise<number> {
		this.resetParams();

		const whereClause = this.buildWhere(query.where, query.whereLogic);
		const sql = `DELETE FROM ${query.table} ${whereClause}`;

		const result = await invoke<QueryResult>('execute_query', {
			sql,
			params: this.params
		});

		return result.rowsAffected;
	}

	/**
	 * Execute a raw parameterized query
	 *
	 * Use this for complex queries that can't be built with the standard methods.
	 * SQL must use ?1, ?2, etc. placeholders.
	 *
	 * @example
	 * ```typescript
	 * const result = await db.raw<{ count: number }>(
	 *   'SELECT COUNT(*) as count FROM users WHERE created_at > ?1',
	 *   ['2024-01-01']
	 * );
	 * ```
	 */
	async raw<T>(sql: string, params: SqlParams = []): Promise<QueryResult<T>> {
		return await invoke<QueryResult<T>>('execute_query', { sql, params });
	}

	/**
	 * Execute multiple queries in a transaction
	 *
	 * All queries succeed or all fail together.
	 *
	 * @example
	 * ```typescript
	 * await db.transaction([
	 *   { sql: 'INSERT INTO users (id, name) VALUES (?1, ?2)', params: ['1', 'John'] },
	 *   { sql: 'INSERT INTO profiles (user_id, bio) VALUES (?1, ?2)', params: ['1', 'Hello'] }
	 * ]);
	 * ```
	 */
	async transaction(queries: QueryRequest[]): Promise<QueryResult[]> {
		return await invoke<QueryResult[]>('execute_transaction', { queries });
	}

	/**
	 * Check if a record exists
	 *
	 * @example
	 * ```typescript
	 * const exists = await db.exists({
	 *   table: 'users',
	 *   where: [{ column: 'email', operator: '=', value: 'john@example.com' }]
	 * });
	 * ```
	 */
	async exists(query: Omit<SelectQuery, 'columns'>): Promise<boolean> {
		const rows = await this.select({
			...query,
			columns: ['1'],
			limit: 1
		});
		return rows.length > 0;
	}

	/**
	 * Get a single record or null
	 *
	 * @example
	 * ```typescript
	 * const user = await db.findOne<User>({
	 *   table: 'users',
	 *   columns: ['id', 'name', 'email'],
	 *   where: [{ column: 'id', operator: '=', value: '123' }]
	 * });
	 * ```
	 */
	async findOne<T>(query: SelectQuery): Promise<T | null> {
		const rows = await this.select<T>({
			...query,
			limit: 1
		});
		return rows[0] ?? null;
	}

	/**
	 * Count records matching the query
	 *
	 * @example
	 * ```typescript
	 * const count = await db.count({
	 *   table: 'users',
	 *   where: [{ column: 'active', operator: '=', value: true }]
	 * });
	 * ```
	 */
	async count(
		query: Omit<SelectQuery, 'columns' | 'orderBy' | 'limit' | 'offset'>
	): Promise<number> {
		const result = await this.select<{ count: number }>({
			...query,
			columns: ['COUNT(*) as count']
		});
		return result[0]?.count ?? 0;
	}
}

/** Singleton instance of the QueryBuilder */
export const db = new QueryBuilder();
