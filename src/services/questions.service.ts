/**
 * Questions Service
 * Manages trivia questions via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { Question } from '$types/question.type';
import type { ID } from '$types/core.type';

/**
 * Get all questions from the database
 */
export async function getQuestionCollection(): Promise<Question[]> {
	try {
		return await invoke<Question[]>('get_all_questions');
	} catch (e) {
		console.error('[questions.service] getQuestionCollection:', e);
		return [];
	}
}

/**
 * Get questions for a specific album
 */
export async function getQuestionsByAlbum(albumId: ID): Promise<Question[]> {
	try {
		return await invoke<Question[]>('get_questions_by_album', { albumId: String(albumId) });
	} catch (e) {
		console.error(`[questions.service] getQuestionsByAlbum(${albumId}):`, e);
		return [];
	}
}

/**
 * Get a single question by ID
 */
export async function getQuestion(id: ID): Promise<Question | null> {
	try {
		return await invoke<Question | null>('get_question', { id: String(id) });
	} catch (e) {
		console.error(`[questions.service] getQuestion(${id}):`, e);
		return null;
	}
}

/**
 * Add a question to the collection
 */
export async function addQuestion(question: Question): Promise<Question | null> {
	try {
		return await invoke<Question>('create_question', { question });
	} catch (e) {
		console.error('[questions.service] addQuestion:', e);
		return null;
	}
}

/**
 * Update a question in the collection
 */
export async function updateQuestion(question: Question): Promise<Question | null> {
	try {
		return await invoke<Question>('update_question', { question });
	} catch (e) {
		console.error('[questions.service] updateQuestion:', e);
		return null;
	}
}

/**
 * Remove a question from the collection
 */
export async function removeQuestion(question: Question): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_question', { id: String(question.id) });
	} catch (e) {
		console.error('[questions.service] removeQuestion:', e);
		return false;
	}
}

/**
 * Remove all questions for an album
 */
export async function removeQuestionsByAlbum(albumId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_questions_by_album', { albumId: String(albumId) });
	} catch (e) {
		console.error(`[questions.service] removeQuestionsByAlbum(${albumId}):`, e);
		return false;
	}
}
