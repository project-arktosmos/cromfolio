/**
 * Pokemon trivia template types for generating tag-driven trivia questions
 */

import type { ID } from '$types/core.type';

export interface PokemonTriviaTemplate {
	id: ID;

	/** The tag key this template is based on (e.g., "type", "ability", "generation") */
	tagKey: string;

	/**
	 * The question template with placeholders like {name} for Pokemon name
	 * Example: "What type is {name}?" or "Which Pokemon has the ability {ability}?"
	 */
	questionTemplate: string;

	/**
	 * The answer template - typically references a tag value
	 * Example: "{type}" or "{ability}"
	 */
	answerTemplate: string;

	/** Whether this template is active and should be used for generation */
	isActive: boolean;

	/** Timestamps */
	createdAt?: string;
	updatedAt?: string;
}

// ============================================================================
// V2 ENHANCED TEMPLATES
// ============================================================================

/**
 * Template types for different question patterns
 */
export type TemplateType =
	| 'simple_match'
	| 'reverse_lookup'
	| 'superlative'
	| 'comparison'
	| 'multi_condition'
	| 'range'
	| 'negation'
	| 'statistical'
	| 'type_effectiveness';

/**
 * Comparison operators for conditions
 */
export type ConditionOperator =
	| 'eq' // equals
	| 'neq' // not equals
	| 'gt' // greater than
	| 'gte' // greater than or equal
	| 'lt' // less than
	| 'lte' // less than or equal
	| 'between' // range (inclusive)
	| 'in' // value in list
	| 'not_in' // value not in list
	| 'contains' // string contains
	| 'exists' // attribute exists
	| 'not_exists' // attribute doesn't exist
	| 'is_max' // highest in scope
	| 'is_min'; // lowest in scope

/**
 * A single condition for filtering Pokemon
 */
export interface TemplateCondition {
	attribute: string;
	operator: ConditionOperator;
	value?: string | number;
	values?: (string | number)[];
}

/**
 * Scope filter for restricting Pokemon pool
 */
export interface ScopeFilter {
	[attribute: string]: string | number | (string | number)[];
}

/**
 * Configuration for comparison-type questions
 */
export interface ComparisonConfig {
	operator: 'max' | 'min';
	attribute: string;
	count: number;
	scope?: ScopeFilter;
}

/**
 * Difficulty levels
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Enhanced Pokemon trivia template v2
 */
export interface PokemonTriviaTemplateV2 {
	id: ID;

	/** Human-readable name for the template */
	name: string;

	/** Description of what this template generates */
	description: string;

	/** The type of question pattern */
	templateType: TemplateType;

	/** Question template with placeholders */
	questionTemplate: string;

	/** Answer template (typically "{name}" for Pokemon answer) */
	answerTemplate: string;

	/** Primary attribute being queried */
	primaryAttribute: string;

	/** JSON-serialized conditions array */
	conditions: string;

	/** Logic for combining conditions: "and" or "or" */
	conditionLogic: 'and' | 'or';

	/** JSON-serialized scope filters object */
	scopeFilters: string;

	/** JSON-serialized comparison config (for superlative/comparison types) */
	comparisonConfig?: string;

	/** Difficulty level */
	difficulty?: Difficulty;

	/** Weighted random selection (higher = more likely) */
	weight: number;

	/** Whether this template is active */
	isActive: boolean;

	/** Timestamps */
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Pokemon attribute metadata for UI
 */
export interface PokemonAttributeInfo {
	label: string;
	type: 'string' | 'number' | 'boolean';
	category: string;
	multi?: boolean;
}

/**
 * Available Pokemon attributes (from tags)
 */
export const POKEMON_ATTRIBUTES: Record<string, PokemonAttributeInfo> = {
	// Basic info
	name: { label: 'Name', type: 'string', category: 'Basic' },
	'pokedex-number': { label: 'Pokedex Number', type: 'number', category: 'Basic' },
	generation: { label: 'Generation', type: 'string', category: 'Basic' },

	// Types
	type: { label: 'Type', type: 'string', category: 'Type', multi: true },

	// Abilities
	ability: { label: 'Ability', type: 'string', category: 'Ability', multi: true },
	'hidden-ability': { label: 'Hidden Ability', type: 'string', category: 'Ability' },

	// Base Stats
	hp: { label: 'HP', type: 'number', category: 'Stats' },
	attack: { label: 'Attack', type: 'number', category: 'Stats' },
	defense: { label: 'Defense', type: 'number', category: 'Stats' },
	'sp-attack': { label: 'Sp. Attack', type: 'number', category: 'Stats' },
	'sp-defense': { label: 'Sp. Defense', type: 'number', category: 'Stats' },
	speed: { label: 'Speed', type: 'number', category: 'Stats' },
	'base-stat-total': { label: 'Base Stat Total', type: 'number', category: 'Stats' },
	'bst-tier': { label: 'BST Tier', type: 'string', category: 'Stats' },

	// Physical
	'height-m': { label: 'Height (m)', type: 'number', category: 'Physical' },
	'weight-kg': { label: 'Weight (kg)', type: 'number', category: 'Physical' },
	'height-class': { label: 'Height Class', type: 'string', category: 'Physical' },
	'weight-class': { label: 'Weight Class', type: 'string', category: 'Physical' },

	// Gender
	'male-percent': { label: 'Male %', type: 'number', category: 'Gender' },
	'female-percent': { label: 'Female %', type: 'number', category: 'Gender' },

	// Type Effectiveness
	'against-normal': { label: 'vs Normal', type: 'number', category: 'Type Effectiveness' },
	'against-fire': { label: 'vs Fire', type: 'number', category: 'Type Effectiveness' },
	'against-water': { label: 'vs Water', type: 'number', category: 'Type Effectiveness' },
	'against-electric': { label: 'vs Electric', type: 'number', category: 'Type Effectiveness' },
	'against-grass': { label: 'vs Grass', type: 'number', category: 'Type Effectiveness' },
	'against-ice': { label: 'vs Ice', type: 'number', category: 'Type Effectiveness' },
	'against-fighting': { label: 'vs Fighting', type: 'number', category: 'Type Effectiveness' },
	'against-poison': { label: 'vs Poison', type: 'number', category: 'Type Effectiveness' },
	'against-ground': { label: 'vs Ground', type: 'number', category: 'Type Effectiveness' },
	'against-flying': { label: 'vs Flying', type: 'number', category: 'Type Effectiveness' },
	'against-psychic': { label: 'vs Psychic', type: 'number', category: 'Type Effectiveness' },
	'against-bug': { label: 'vs Bug', type: 'number', category: 'Type Effectiveness' },
	'against-rock': { label: 'vs Rock', type: 'number', category: 'Type Effectiveness' },
	'against-ghost': { label: 'vs Ghost', type: 'number', category: 'Type Effectiveness' },
	'against-dragon': { label: 'vs Dragon', type: 'number', category: 'Type Effectiveness' },
	'against-dark': { label: 'vs Dark', type: 'number', category: 'Type Effectiveness' },
	'against-steel': { label: 'vs Steel', type: 'number', category: 'Type Effectiveness' },
	'against-fairy': { label: 'vs Fairy', type: 'number', category: 'Type Effectiveness' },

	// Breeding
	'capture-rate': { label: 'Capture Rate', type: 'number', category: 'Breeding' },
	'base-happiness': { label: 'Base Happiness', type: 'number', category: 'Breeding' },
	'base-egg-steps': { label: 'Base Egg Steps', type: 'number', category: 'Breeding' },
	'experience-growth': { label: 'Experience Growth', type: 'string', category: 'Breeding' },
	'catch-difficulty': { label: 'Catch Difficulty', type: 'string', category: 'Breeding' },

	// Special
	legendary: { label: 'Is Legendary', type: 'boolean', category: 'Special' },
	'mega-evolution': { label: 'Has Mega Evolution', type: 'boolean', category: 'Special' }
};

/**
 * Template type descriptions for UI
 */
export const TEMPLATE_TYPE_INFO: Record<
	TemplateType,
	{ label: string; description: string; example: string; icon: string }
> = {
	simple_match: {
		label: 'Simple Match',
		description: "Ask about a known Pokemon's attribute",
		example: 'What type is Pikachu? → Electric',
		icon: '❓'
	},
	reverse_lookup: {
		label: 'Reverse Lookup',
		description: 'Find Pokemon with a specific attribute',
		example: 'Which Pokemon has the ability Static? → Pikachu',
		icon: '🔍'
	},
	superlative: {
		label: 'Superlative',
		description: 'Find the highest/lowest in a category',
		example: 'Which Pokemon has the highest attack? → Mewtwo',
		icon: '🏆'
	},
	comparison: {
		label: 'Comparison',
		description: 'Compare specific Pokemon',
		example: 'Which has higher attack: Pikachu or Charmander?',
		icon: '⚖️'
	},
	multi_condition: {
		label: 'Multi-Condition',
		description: 'Find Pokemon matching multiple criteria',
		example: 'Which Fire type is from Generation 1? → Charmander',
		icon: '🔗'
	},
	range: {
		label: 'Range',
		description: 'Find Pokemon within a value range',
		example: 'Which Pokemon weighs over 100kg? → Snorlax',
		icon: '📊'
	},
	negation: {
		label: 'Negation',
		description: 'Find Pokemon NOT matching criteria',
		example: 'Which of these is NOT Water type?',
		icon: '🚫'
	},
	statistical: {
		label: 'Statistical',
		description: 'Questions about attribute counts/existence',
		example: 'Which Pokemon has no secondary type?',
		icon: '📈'
	},
	type_effectiveness: {
		label: 'Type Effectiveness',
		description: 'Questions about damage multipliers',
		example: 'Which Pokemon takes 4x damage from Fire?',
		icon: '⚡'
	}
};

/**
 * Condition operator labels for UI
 */
export const CONDITION_OPERATOR_INFO: Record<
	ConditionOperator,
	{ label: string; requiresValue: boolean; requiresValues: boolean }
> = {
	eq: { label: 'equals', requiresValue: true, requiresValues: false },
	neq: { label: 'not equals', requiresValue: true, requiresValues: false },
	gt: { label: 'greater than', requiresValue: true, requiresValues: false },
	gte: { label: 'greater or equal', requiresValue: true, requiresValues: false },
	lt: { label: 'less than', requiresValue: true, requiresValues: false },
	lte: { label: 'less or equal', requiresValue: true, requiresValues: false },
	between: { label: 'between', requiresValue: false, requiresValues: true },
	in: { label: 'is one of', requiresValue: false, requiresValues: true },
	not_in: { label: 'is not one of', requiresValue: false, requiresValues: true },
	contains: { label: 'contains', requiresValue: true, requiresValues: false },
	exists: { label: 'exists', requiresValue: false, requiresValues: false },
	not_exists: { label: 'does not exist', requiresValue: false, requiresValues: false },
	is_max: { label: 'is maximum', requiresValue: false, requiresValues: false },
	is_min: { label: 'is minimum', requiresValue: false, requiresValues: false }
};

/**
 * Helper to parse conditions from JSON string
 */
export function parseConditions(conditionsJson: string): TemplateCondition[] {
	try {
		return JSON.parse(conditionsJson) as TemplateCondition[];
	} catch {
		return [];
	}
}

/**
 * Helper to stringify conditions to JSON
 */
export function stringifyConditions(conditions: TemplateCondition[]): string {
	return JSON.stringify(conditions);
}

/**
 * Helper to parse scope filters from JSON string
 */
export function parseScopeFilters(scopeFiltersJson: string): ScopeFilter {
	try {
		return JSON.parse(scopeFiltersJson) as ScopeFilter;
	} catch {
		return {};
	}
}

/**
 * Helper to stringify scope filters to JSON
 */
export function stringifyScopeFilters(scopeFilters: ScopeFilter): string {
	return JSON.stringify(scopeFilters);
}

/**
 * Helper to parse comparison config from JSON string
 */
export function parseComparisonConfig(configJson: string | undefined): ComparisonConfig | null {
	if (!configJson) return null;
	try {
		return JSON.parse(configJson) as ComparisonConfig;
	} catch {
		return null;
	}
}

/**
 * Helper to stringify comparison config to JSON
 */
export function stringifyComparisonConfig(config: ComparisonConfig | null): string | undefined {
	if (!config) return undefined;
	return JSON.stringify(config);
}
