<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import type { Collection } from '$types/collection.type';
	import type { Question } from '$types/question.type';
	import type { Sticker } from '$types/sticker.type';

	// Tag type from database
	interface Tag {
		id: string;
		key: string;
		value: string;
	}

	// Types for generated preview
	interface GeneratedQuestion {
		id: string;
		questionText: string;
		correctAnswer: string;
		wrongAnswers: string[];
		category: string;
		skipped?: boolean;
		skipReason?: string;
	}

	// State
	let collections = $state<Collection[]>([]);
	let selectedCollection = $state<Collection | null>(null);
	let searchQuery = $state('');

	// Generated questions (preview)
	let generatedQuestions = $state<GeneratedQuestion[]>([]);
	let skippedQuestions = $state<GeneratedQuestion[]>([]);
	let isGenerating = $state(false);
	let generationProgress = $state({ current: 0, total: 0 });

	// DB questions
	let dbQuestions = $state<Question[]>([]);
	let isLoadingDb = $state(false);

	// Filters for generated
	let categoryFilter = $state<string>('all');

	// Filtered collections based on search
	let filteredCollections = $derived.by(() => {
		if (!searchQuery.trim()) return collections;
		const query = searchQuery.toLowerCase();
		return collections.filter((c) => c.title.toLowerCase().includes(query));
	});

	// Available categories from generated questions
	let availableCategories = $derived.by(() => {
		const categories = new Set<string>();
		generatedQuestions.forEach((q) => {
			if (q.category) categories.add(q.category);
		});
		return Array.from(categories).sort();
	});

	let filteredGeneratedQuestions = $derived.by(() => {
		const validQuestions = categoryFilter === 'all'
			? generatedQuestions
			: generatedQuestions.filter((q) => q.category === categoryFilter);
		const filteredSkipped = categoryFilter === 'all'
			? skippedQuestions
			: skippedQuestions.filter((q) => q.category === categoryFilter);
		return [...validQuestions, ...filteredSkipped];
	});

	// Format category name for display
	function formatCategoryName(category: string): string {
		return category
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Strip fragment position from sticker name (e.g., "Movie (Top Left)" -> "Movie")
	function stripFragmentPosition(name: string): string {
		return name.replace(/\s*\((Top|Bottom)\s+(Left|Right)\)\s*$/i, '').trim();
	}

	onMount(async () => {
		try {
			collections = await invoke<Collection[]>('get_all_collections');
		} catch (error) {
			console.error('Failed to fetch collections:', error);
			collections = [];
		}
	});

	// Select a collection
	async function selectCollection(collection: Collection) {
		if (selectedCollection?.id === collection.id) {
			// Deselect
			selectedCollection = null;
			generatedQuestions = [];
			dbQuestions = [];
			return;
		}

		selectedCollection = collection;
		generatedQuestions = [];
		skippedQuestions = [];
		dbQuestions = [];
		categoryFilter = 'all';

		// Generate questions from DB stickers/tags
		generateQuestionsFromDb(collection);
		loadDbQuestions(collection);
	}

	// Load DB questions
	async function loadDbQuestions(collection: Collection) {
		isLoadingDb = true;
		try {
			dbQuestions = await invoke<Question[]>('get_questions_by_source', {
				sourceId: String(collection.id)
			});
		} catch (error) {
			console.error('Failed to fetch db questions:', error);
			dbQuestions = [];
		} finally {
			isLoadingDb = false;
		}
	}

	// Generate questions from database stickers and their tags
	async function generateQuestionsFromDb(collection: Collection) {
		isGenerating = true;
		generatedQuestions = [];
		skippedQuestions = [];

		try {
			// Get all stickers for this collection
			const stickers = await invoke<Sticker[]>('get_stickers_for_collection', {
				collectionId: String(collection.id)
			});

			if (stickers.length === 0) {
				isGenerating = false;
				return;
			}

			generationProgress = { current: 0, total: stickers.length };

			// Get tags for each sticker and build category map
			// Map: category -> { winners: Sticker[], nominees: Sticker[] }
			const categoryMap = new Map<string, { winners: Sticker[]; nominees: Sticker[] }>();

			for (let i = 0; i < stickers.length; i++) {
				const sticker = stickers[i];
				generationProgress = { current: i + 1, total: stickers.length };

				const tags = await invoke<Tag[]>('get_tags_by_sticker', {
					stickerId: String(sticker.id)
				});

				// Extract tag values
				let category = '';
				let status = '';

				for (const tag of tags) {
					if (tag.key === 'award_category') category = tag.value;
					if (tag.key === 'award_status') status = tag.value;
				}

				if (!category || !status) continue;

				if (!categoryMap.has(category)) {
					categoryMap.set(category, { winners: [], nominees: [] });
				}

				const entry = categoryMap.get(category)!;
				if (status === 'winner') {
					entry.winners.push(sticker);
				} else if (status === 'nominee') {
					entry.nominees.push(sticker);
				}
			}

			// Generate questions from category map
			const generated: GeneratedQuestion[] = [];
			const skipped: GeneratedQuestion[] = [];

			for (const [category, { winners, nominees }] of categoryMap) {
				// Deduplicate winners by base name (strip fragment positions)
				const seenWinnerNames = new Set<string>();
				const uniqueWinnerNames: string[] = [];
				for (const winner of winners) {
					const baseName = stripFragmentPosition(winner.name);
					if (!seenWinnerNames.has(baseName)) {
						seenWinnerNames.add(baseName);
						uniqueWinnerNames.push(baseName);
					}
				}

				// Deduplicate nominees by base name
				const seenNomineeNames = new Set<string>();
				const uniqueNominees: string[] = [];
				for (const nominee of nominees) {
					const baseName = stripFragmentPosition(nominee.name);
					if (!seenNomineeNames.has(baseName)) {
						seenNomineeNames.add(baseName);
						uniqueNominees.push(baseName);
					}
				}

				// Need at least one winner
				if (uniqueWinnerNames.length === 0) {
					skipped.push({
						id: `${collection.id}-${category}-skipped`,
						questionText: `Who won ${formatCategoryName(category)} at the ${collection.title}?`,
						correctAnswer: '(no winner)',
						wrongAnswers: uniqueNominees,
						category,
						skipped: true,
						skipReason: 'No winner found'
					});
					continue;
				}

				// Valid question - has at least one winner
				generated.push({
					id: `${collection.id}-${category}`,
					questionText: `Who won ${formatCategoryName(category)} at the ${collection.title}?`,
					correctAnswer: uniqueWinnerNames[0],
					wrongAnswers: uniqueNominees,
					category
				});
			}

			generatedQuestions = generated;
			skippedQuestions = skipped;
		} catch (error) {
			console.error('Failed to generate questions from DB:', error);
		} finally {
			isGenerating = false;
		}
	}

	// Copy generated questions to clipboard (only valid ones)
	async function copyGeneratedToClipboard() {
		const validQuestions = filteredGeneratedQuestions.filter((q) => !q.skipped);
		const data = validQuestions.map((q) => ({
			questionText: q.questionText,
			correctAnswer: q.correctAnswer,
			wrongAnswers: q.wrongAnswers
		}));
		await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
	}

	// Save generated questions to DB (only valid ones)
	let isSaving = $state(false);
	async function saveToDb() {
		if (!selectedCollection) return;

		const validQuestions = filteredGeneratedQuestions.filter((q) => !q.skipped);
		isSaving = true;
		let saved = 0;
		let failed = 0;

		for (const q of validQuestions) {
			try {
				await invoke('create_question', {
					question: {
						id: q.id,
						sourceId: String(selectedCollection.id),
						questionText: q.questionText,
						correctAnswer: q.correctAnswer,
						wrongAnswers: q.wrongAnswers
					}
				});
				saved++;
			} catch (error) {
				console.error('Failed to save question:', error);
				failed++;
			}
		}

		isSaving = false;
		// Reload DB questions
		loadDbQuestions(selectedCollection);
		alert(`Saved ${saved} questions. ${failed > 0 ? `${failed} failed.` : ''}`);
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Trivia Questions</h1>

	<div class="grid grid-cols-4 gap-4 flex-1 min-h-0">
		<!-- Column 1: Collections List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Collections</h2>

				<input
					type="text"
					placeholder="Search collections..."
					class="input input-bordered input-sm w-full mb-3"
					bind:value={searchQuery}
				/>

				<div class="flex-1 overflow-y-auto">
					{#if filteredCollections.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No collections found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each filteredCollections as collection (collection.id)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedCollection?.id === collection.id,
											'bg-base-100': selectedCollection?.id !== collection.id
										}
									)}
									onclick={() => selectCollection(collection)}
									onkeydown={(e) => e.key === 'Enter' && selectCollection(collection)}
									role="button"
									tabindex="0"
								>
									<div class="font-medium text-sm">{collection.title}</div>
									<div class="text-xs text-base-content/60">{collection.id}</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
					{filteredCollections.length} collection{filteredCollections.length !== 1 ? 's' : ''}
				</div>
			</div>
		</div>

		<!-- Column 2: Generated Preview -->
		<div class="card bg-base-200 overflow-hidden flex flex-col col-span-2">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">Generated Preview</h2>
					{#if generatedQuestions.length > 0}
						<div class="flex gap-2">
							<button class="btn btn-outline btn-sm" onclick={copyGeneratedToClipboard}>
								Copy
							</button>
							<button
								class="btn btn-primary btn-sm"
								onclick={saveToDb}
								disabled={isSaving}
							>
								{#if isSaving}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									Save to DB ({generatedQuestions.length})
								{/if}
							</button>
						</div>
					{/if}
				</div>

				{#if isGenerating}
					<div class="flex flex-col items-center justify-center p-8">
						<span class="loading loading-spinner loading-lg mb-4"></span>
						<p class="text-base-content/70">
							Generating... {generationProgress.current} / {generationProgress.total}
						</p>
						<progress
							class="progress progress-primary w-64 mt-2"
							value={generationProgress.current}
							max={generationProgress.total}
						></progress>
					</div>
				{:else if !selectedCollection}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a collection to generate preview.</p>
					</div>
				{:else if generatedQuestions.length === 0 && skippedQuestions.length === 0}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>No award data for this collection.</p>
					</div>
				{:else}
					<!-- Filters -->
					<div class="flex items-center gap-2 mb-3 flex-wrap">
						<div class="badge badge-success">{generatedQuestions.length} generated</div>
						{#if skippedQuestions.length > 0}
							<div class="badge badge-warning">{skippedQuestions.length} skipped</div>
						{/if}
						<div class="flex-1"></div>
						<select class="select select-bordered select-xs" bind:value={categoryFilter}>
							<option value="all">All Categories</option>
							{#each availableCategories as cat}
								<option value={cat}>{formatCategoryName(cat)}</option>
							{/each}
						</select>
					</div>

					<div class="flex-1 overflow-y-auto">
						<div class="space-y-2">
							{#each filteredGeneratedQuestions as question (question.id)}
								<div class={classNames('bg-base-100 p-2 rounded-lg', { 'opacity-50': question.skipped })}>
									<div class="mb-1 flex items-center gap-1">
										<span class="badge badge-xs badge-ghost">{formatCategoryName(question.category)}</span>
										{#if question.skipped}
											<span class="badge badge-xs badge-warning">{question.skipReason}</span>
										{/if}
									</div>
									<div class="text-sm line-clamp-2">{question.questionText}</div>
									<div class="mt-2">
										<div class="text-xs text-success font-semibold mb-1">Correct:</div>
										<div class="bg-success/20 text-success p-1 rounded text-xs">{question.correctAnswer}</div>
									</div>
									<div class="mt-2">
										<div class="text-xs text-base-content/60 mb-1">Wrong answers ({question.wrongAnswers.length}):</div>
										<div class="flex flex-wrap gap-1">
											{#each question.wrongAnswers as wrong}
												<span class="badge badge-xs badge-outline">{wrong}</span>
											{/each}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
						Showing {filteredGeneratedQuestions.length} of {generatedQuestions.length}
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 3: DB Questions -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">DB Questions</h2>

				{#if isLoadingDb}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner"></span>
					</div>
				{:else if !selectedCollection}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm text-center">Select a collection.</p>
					</div>
				{:else if dbQuestions.length === 0}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm text-center">No questions in DB.</p>
					</div>
				{:else}
					<div class="badge badge-info mb-2">{dbQuestions.length} in DB</div>
					<div class="flex-1 overflow-y-auto">
						<div class="space-y-2">
							{#each dbQuestions as question (question.id)}
								<div class="bg-base-100 p-2 rounded-lg">
									<div class="text-sm line-clamp-2">{question.questionText}</div>
									<div class="mt-1">
										<div class="bg-success/20 text-success p-1 rounded text-xs">{question.correctAnswer}</div>
									</div>
									{#if question.wrongAnswers && question.wrongAnswers.length > 0}
										<div class="mt-1 flex flex-wrap gap-1">
											{#each question.wrongAnswers as wrong}
												<span class="badge badge-xs badge-outline">{wrong}</span>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
