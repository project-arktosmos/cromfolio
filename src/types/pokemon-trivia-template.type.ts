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
