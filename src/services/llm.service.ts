/**
 * LLM Service
 * Manages LLM server configurations and chat via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { LlmConfig, LlmModel, LlmChatOptions, LlmDefaults } from '$types/llm.type';
import type { ID } from '$types/core.type';

// ============================================================================
// Configuration CRUD
// ============================================================================

/**
 * Get all LLM configurations
 */
export async function getLlmConfigs(): Promise<LlmConfig[]> {
	try {
		return await invoke<LlmConfig[]>('get_all_llm_configs');
	} catch (e) {
		console.error('[llm.service] getLlmConfigs:', e);
		return [];
	}
}

/**
 * Get a single LLM configuration by ID
 */
export async function getLlmConfig(id: ID): Promise<LlmConfig | null> {
	try {
		return await invoke<LlmConfig | null>('get_llm_config', { id: String(id) });
	} catch (e) {
		console.error(`[llm.service] getLlmConfig(${id}):`, e);
		return null;
	}
}

/**
 * Get the default LLM configuration
 */
export async function getDefaultLlmConfig(): Promise<LlmConfig | null> {
	try {
		return await invoke<LlmConfig | null>('get_default_llm_config');
	} catch (e) {
		console.error('[llm.service] getDefaultLlmConfig:', e);
		return null;
	}
}

/**
 * Create a new LLM configuration
 */
export async function createLlmConfig(config: Partial<LlmConfig>): Promise<LlmConfig | null> {
	try {
		return await invoke<LlmConfig>('create_llm_config', { llmConfig: config });
	} catch (e) {
		console.error('[llm.service] createLlmConfig:', e);
		return null;
	}
}

/**
 * Update an existing LLM configuration
 */
export async function updateLlmConfig(config: LlmConfig): Promise<LlmConfig | null> {
	try {
		return await invoke<LlmConfig>('update_llm_config', { llmConfig: config });
	} catch (e) {
		console.error('[llm.service] updateLlmConfig:', e);
		return null;
	}
}

/**
 * Delete an LLM configuration
 */
export async function deleteLlmConfig(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_llm_config', { id: String(id) });
	} catch (e) {
		console.error(`[llm.service] deleteLlmConfig(${id}):`, e);
		return false;
	}
}

/**
 * Set a configuration as the default
 */
export async function setDefaultLlmConfig(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('set_default_llm_config', { id: String(id) });
	} catch (e) {
		console.error(`[llm.service] setDefaultLlmConfig(${id}):`, e);
		return false;
	}
}

// ============================================================================
// Server Interaction
// ============================================================================

/**
 * Check if an LLM server is online
 */
export async function checkLlmServer(baseUrl: string, provider: string): Promise<boolean> {
	try {
		return await invoke<boolean>('check_llm_server', { baseUrl, provider });
	} catch (e) {
		console.error('[llm.service] checkLlmServer:', e);
		return false;
	}
}

/**
 * Get available models from an LLM server
 */
export async function getLlmModels(baseUrl: string, provider: string): Promise<LlmModel[]> {
	try {
		return await invoke<LlmModel[]>('get_llm_models', { baseUrl, provider });
	} catch (e) {
		console.error('[llm.service] getLlmModels:', e);
		return [];
	}
}

/**
 * Send a chat message to an LLM and get a response
 */
export async function chatLlm(
	baseUrl: string,
	provider: string,
	model: string,
	messages: Array<{ role: string; content: string }>,
	options?: LlmChatOptions
): Promise<string | null> {
	try {
		return await invoke<string>('chat_llm', {
			baseUrl,
			provider,
			model,
			messages,
			options: options || null
		});
	} catch (e) {
		console.error('[llm.service] chatLlm:', e);
		return null;
	}
}

/**
 * Get default LLM server URLs from backend configuration (.env)
 */
export async function getLlmDefaults(): Promise<LlmDefaults | null> {
	try {
		return await invoke<LlmDefaults>('get_llm_defaults');
	} catch (e) {
		console.error('[llm.service] getLlmDefaults:', e);
		return null;
	}
}
