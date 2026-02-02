/**
 * Pokemon Trivia Templates Service
 * Manages Pokemon trivia templates via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { PokemonTriviaTemplate } from '$types/pokemon-trivia-template.type';
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
