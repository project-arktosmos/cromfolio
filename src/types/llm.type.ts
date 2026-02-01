/**
 * LLM types for local LLM server integration
 */

import type { ID } from '$types/core.type';

export type LlmProvider = 'lmstudio' | 'ollama';

export interface LlmConfig {
	id: ID;
	name: string;
	provider: LlmProvider;
	baseUrl: string;
	isDefault: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface LlmModel {
	id: string;
	name: string;
	provider: LlmProvider;
	size?: number;
	modifiedAt?: string;
	family?: string;
	parameterSize?: string;
	quantizationLevel?: string;
}

export interface ChatMessage {
	id: string;
	role: 'system' | 'user' | 'assistant';
	content: string;
	timestamp: string;
}

export interface LlmChatOptions {
	temperature?: number;
	maxTokens?: number;
	systemPrompt?: string;
}

export interface LlmDefaults {
	ollamaBaseUrl: string;
	lmstudioBaseUrl: string;
}

// Fallback defaults in case backend call fails
export const DEFAULT_URLS: Record<LlmProvider, string> = {
	lmstudio: 'http://localhost:1234',
	ollama: 'http://localhost:11434'
};
