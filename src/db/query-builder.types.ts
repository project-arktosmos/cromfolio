/**
 * TypeScript Query Builder Types
 *
 * This module provides type definitions for building parameterized SQL queries
 * in TypeScript. All values are passed as parameters (never interpolated) to
 * prevent SQL injection.
 */

/** SQL value types that can be safely passed as parameters */
export type SqlValue = string | number | boolean | null;

/** Array of SQL parameters for parameterized queries */
export type SqlParams = SqlValue[];

/** Result structure returned from Rust query executor */
export interface QueryResult<T = unknown> {
	rows: T[];
	rowsAffected: number;
	lastInsertId: string | null;
}

/** Column definition for schema validation */
export interface ColumnDef {
	name: string;
	type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
	nullable?: boolean;
	primaryKey?: boolean;
	foreignKey?: { table: string; column: string };
}

/** Table schema definition - single source of truth for TypeScript */
export interface TableSchema {
	name: string;
	columns: Record<string, ColumnDef>;
}

/** Supported WHERE clause operators */
export type WhereOperator =
	| '='
	| '!='
	| '>'
	| '<'
	| '>='
	| '<='
	| 'LIKE'
	| 'NOT LIKE'
	| 'IN'
	| 'NOT IN'
	| 'IS NULL'
	| 'IS NOT NULL'
	| 'BETWEEN'
	| 'GLOB';

/** A single WHERE condition */
export interface WhereCondition {
	column: string;
	operator: WhereOperator;
	value?: SqlValue | SqlValue[];
	/** For BETWEEN operator: [min, max] */
	betweenValues?: [SqlValue, SqlValue];
}

/** JOIN clause configuration */
export interface JoinClause {
	type: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
	table: string;
	alias?: string;
	on: {
		left: string;
		right: string;
	};
}

/** ORDER BY configuration */
export interface OrderByClause {
	column: string;
	direction: 'ASC' | 'DESC';
	/** NULLS FIRST or NULLS LAST */
	nulls?: 'FIRST' | 'LAST';
}

/** SELECT query configuration */
export interface SelectQuery {
	table: string;
	alias?: string;
	columns: string[];
	distinct?: boolean;
	where?: WhereCondition[];
	/** Logical operator between WHERE conditions (default: AND) */
	whereLogic?: 'AND' | 'OR';
	orderBy?: OrderByClause[];
	limit?: number;
	offset?: number;
	joins?: JoinClause[];
	groupBy?: string[];
	having?: WhereCondition[];
}

/** INSERT query configuration */
export interface InsertQuery {
	table: string;
	columns: string[];
	values: SqlValue[];
	/** For INSERT OR REPLACE / INSERT OR IGNORE */
	conflictAction?: 'REPLACE' | 'IGNORE' | 'ABORT' | 'ROLLBACK' | 'FAIL';
}

/** Batch INSERT query configuration */
export interface BatchInsertQuery {
	table: string;
	columns: string[];
	/** Array of value arrays, one per row */
	rows: SqlValue[][];
	conflictAction?: 'REPLACE' | 'IGNORE' | 'ABORT' | 'ROLLBACK' | 'FAIL';
}

/** UPDATE query configuration */
export interface UpdateQuery {
	table: string;
	set: Record<string, SqlValue>;
	where: WhereCondition[];
	whereLogic?: 'AND' | 'OR';
}

/** DELETE query configuration */
export interface DeleteQuery {
	table: string;
	where: WhereCondition[];
	whereLogic?: 'AND' | 'OR';
}

/** Request payload sent to Rust execute_query command */
export interface QueryRequest {
	sql: string;
	params: SqlValue[];
	/** Return the inserted/updated row (requires SELECT after INSERT/UPDATE) */
	returnData?: boolean;
}

/** Batch query request for transactions */
export interface TransactionRequest {
	queries: QueryRequest[];
}

/** Error response from query execution */
export interface QueryError {
	code: string;
	message: string;
	sql?: string;
}
