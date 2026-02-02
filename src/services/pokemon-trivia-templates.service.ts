/**
 * Pokemon Trivia Templates Service
 * Manages Pokemon trivia templates via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { PokemonTriviaTemplate, PokemonTriviaTemplateV2 } from '$types/pokemon-trivia-template.type';
import type { ID } from '$types/core.type';

/**
 * Get all Pokemon trivia templates from the database
 */
export async function getAllPokemonTriviaTemplates(): Promise<PokemonTriviaTemplate[]> {
	try {
		return await invoke<PokemonTriviaTemplate[]>('get_all_pokemon_trivia_templates');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getAllPokemonTriviaTemplates:', e);
		return [];
	}
}

/**
 * Get a single Pokemon trivia template by ID
 */
export async function getPokemonTriviaTemplate(id: ID): Promise<PokemonTriviaTemplate | null> {
	try {
		return await invoke<PokemonTriviaTemplate | null>('get_pokemon_trivia_template', {
			id: String(id)
		});
	} catch (e) {
		console.error(`[pokemon-trivia-templates.service] getPokemonTriviaTemplate(${id}):`, e);
		return null;
	}
}

/**
 * Get Pokemon trivia templates by tag key
 */
export async function getPokemonTriviaTemplatesByTagKey(
	tagKey: string
): Promise<PokemonTriviaTemplate[]> {
	try {
		return await invoke<PokemonTriviaTemplate[]>('get_pokemon_trivia_templates_by_tag_key', {
			tagKey
		});
	} catch (e) {
		console.error(
			`[pokemon-trivia-templates.service] getPokemonTriviaTemplatesByTagKey(${tagKey}):`,
			e
		);
		return [];
	}
}

/**
 * Get all active Pokemon trivia templates
 */
export async function getActivePokemonTriviaTemplates(): Promise<PokemonTriviaTemplate[]> {
	try {
		return await invoke<PokemonTriviaTemplate[]>('get_active_pokemon_trivia_templates');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getActivePokemonTriviaTemplates:', e);
		return [];
	}
}

/**
 * Get all unique tag keys that have templates defined
 */
export async function getPokemonTriviaTemplateTagKeys(): Promise<string[]> {
	try {
		return await invoke<string[]>('get_pokemon_trivia_template_tag_keys');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getPokemonTriviaTemplateTagKeys:', e);
		return [];
	}
}

/**
 * Create a new Pokemon trivia template
 */
export async function createPokemonTriviaTemplate(
	template: Omit<PokemonTriviaTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PokemonTriviaTemplate | null> {
	try {
		return await invoke<PokemonTriviaTemplate>('create_pokemon_trivia_template', { template });
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] createPokemonTriviaTemplate:', e);
		return null;
	}
}

/**
 * Update an existing Pokemon trivia template
 */
export async function updatePokemonTriviaTemplate(
	template: PokemonTriviaTemplate
): Promise<PokemonTriviaTemplate | null> {
	try {
		return await invoke<PokemonTriviaTemplate>('update_pokemon_trivia_template', { template });
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] updatePokemonTriviaTemplate:', e);
		return null;
	}
}

/**
 * Delete a Pokemon trivia template by ID
 */
export async function deletePokemonTriviaTemplate(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_pokemon_trivia_template', { id: String(id) });
	} catch (e) {
		console.error(`[pokemon-trivia-templates.service] deletePokemonTriviaTemplate(${id}):`, e);
		return false;
	}
}

// ============================================================================
// V2 ENHANCED TEMPLATES
// ============================================================================

/**
 * Get all Pokemon trivia templates v2 from the database
 */
export async function getAllPokemonTriviaTemplatesV2(): Promise<PokemonTriviaTemplateV2[]> {
	try {
		return await invoke<PokemonTriviaTemplateV2[]>('get_all_pokemon_trivia_templates_v2');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getAllPokemonTriviaTemplatesV2:', e);
		return [];
	}
}

/**
 * Get a single Pokemon trivia template v2 by ID
 */
export async function getPokemonTriviaTemplateV2(
	id: ID
): Promise<PokemonTriviaTemplateV2 | null> {
	try {
		return await invoke<PokemonTriviaTemplateV2 | null>('get_pokemon_trivia_template_v2', {
			id: String(id)
		});
	} catch (e) {
		console.error(`[pokemon-trivia-templates.service] getPokemonTriviaTemplateV2(${id}):`, e);
		return null;
	}
}

/**
 * Get Pokemon trivia templates v2 by template type
 */
export async function getPokemonTriviaTemplatesV2ByType(
	templateType: string
): Promise<PokemonTriviaTemplateV2[]> {
	try {
		return await invoke<PokemonTriviaTemplateV2[]>('get_pokemon_trivia_templates_v2_by_type', {
			templateType
		});
	} catch (e) {
		console.error(
			`[pokemon-trivia-templates.service] getPokemonTriviaTemplatesV2ByType(${templateType}):`,
			e
		);
		return [];
	}
}

/**
 * Get Pokemon trivia templates v2 by primary attribute
 */
export async function getPokemonTriviaTemplatesV2ByAttribute(
	primaryAttribute: string
): Promise<PokemonTriviaTemplateV2[]> {
	try {
		return await invoke<PokemonTriviaTemplateV2[]>(
			'get_pokemon_trivia_templates_v2_by_attribute',
			{ primaryAttribute }
		);
	} catch (e) {
		console.error(
			`[pokemon-trivia-templates.service] getPokemonTriviaTemplatesV2ByAttribute(${primaryAttribute}):`,
			e
		);
		return [];
	}
}

/**
 * Get all active Pokemon trivia templates v2
 */
export async function getActivePokemonTriviaTemplatesV2(): Promise<PokemonTriviaTemplateV2[]> {
	try {
		return await invoke<PokemonTriviaTemplateV2[]>('get_active_pokemon_trivia_templates_v2');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getActivePokemonTriviaTemplatesV2:', e);
		return [];
	}
}

/**
 * Get Pokemon trivia templates v2 by difficulty
 */
export async function getPokemonTriviaTemplatesV2ByDifficulty(
	difficulty: string
): Promise<PokemonTriviaTemplateV2[]> {
	try {
		return await invoke<PokemonTriviaTemplateV2[]>(
			'get_pokemon_trivia_templates_v2_by_difficulty',
			{ difficulty }
		);
	} catch (e) {
		console.error(
			`[pokemon-trivia-templates.service] getPokemonTriviaTemplatesV2ByDifficulty(${difficulty}):`,
			e
		);
		return [];
	}
}

/**
 * Get all unique template types that have templates
 */
export async function getPokemonTriviaTemplateV2Types(): Promise<string[]> {
	try {
		return await invoke<string[]>('get_pokemon_trivia_template_v2_types');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getPokemonTriviaTemplateV2Types:', e);
		return [];
	}
}

/**
 * Get all unique primary attributes that have templates
 */
export async function getPokemonTriviaTemplateV2Attributes(): Promise<string[]> {
	try {
		return await invoke<string[]>('get_pokemon_trivia_template_v2_attributes');
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] getPokemonTriviaTemplateV2Attributes:', e);
		return [];
	}
}

/**
 * Create a new Pokemon trivia template v2
 */
export async function createPokemonTriviaTemplateV2(
	template: Omit<PokemonTriviaTemplateV2, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PokemonTriviaTemplateV2 | null> {
	try {
		return await invoke<PokemonTriviaTemplateV2>('create_pokemon_trivia_template_v2', {
			template
		});
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] createPokemonTriviaTemplateV2:', e);
		return null;
	}
}

/**
 * Update an existing Pokemon trivia template v2
 */
export async function updatePokemonTriviaTemplateV2(
	template: PokemonTriviaTemplateV2
): Promise<PokemonTriviaTemplateV2 | null> {
	try {
		return await invoke<PokemonTriviaTemplateV2>('update_pokemon_trivia_template_v2', {
			template
		});
	} catch (e) {
		console.error('[pokemon-trivia-templates.service] updatePokemonTriviaTemplateV2:', e);
		return null;
	}
}

/**
 * Delete a Pokemon trivia template v2 by ID
 */
export async function deletePokemonTriviaTemplateV2(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_pokemon_trivia_template_v2', { id: String(id) });
	} catch (e) {
		console.error(`[pokemon-trivia-templates.service] deletePokemonTriviaTemplateV2(${id}):`, e);
		return false;
	}
}
