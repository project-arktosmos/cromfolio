<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getSourceCollection } from '$services/sources.service';
	import {
		getQuestionsBySource,
		addQuestion as addQuestionService,
		updateQuestion as updateQuestionService,
		removeQuestion as removeQuestionService
	} from '$services/questions.service';
	import {
		fetchTriviaForSource,
		convertToQuestion
	} from '$services/trivia-fetch.service';
	import type { Source, SourceType } from '$types/source.type';
	import type { Question, Difficulty } from '$types/question.type';
	import type { FetchedTrivia, TriviaSource } from '$types/trivia-api.type';

	// Collection state
	let sources: Source[] = $state([]);
	let questions: Question[] = $state([]);
	let isLoadingSources = $state(true);
	let isLoadingQuestions = $state(false);
	let isSaving = $state(false);

	// Selection state
	let selectedSource = $state<Source | null>(null);
	let selectedQuestion = $state<Question | null>(null);

	// Filter state
	let sourceTypeFilter = $state<SourceType | 'all'>('all');
	let searchQuery = $state('');

	// Form state
	let isEditing = $state(false);
	let formQuestionText = $state('');
	let formCorrectAnswer = $state('');
	let formWrongAnswers = $state<string[]>(['', '']); // Start with 2 empty wrong answers
	let formDifficulty = $state<Difficulty | ''>('');

	// Fetch trivia state
	let showFetchModal = $state(false);
	let isFetching = $state(false);
	let fetchedTrivia = $state<FetchedTrivia[]>([]);
	let showPreview = $state(false);
	let fetchSources = $state<TriviaSource[]>(['thetriviaapi', 'wikipedia']);
	let fetchDifficulty = $state<Difficulty | ''>('');
	let fetchAmount = $state(10);
	let fetchErrors = $state<{ source: TriviaSource; message: string }[]>([]);
	let isImporting = $state(false);

	// Source type labels for display
	const sourceTypeLabels: Record<SourceType, string> = {
		movie: 'Movies',
		tv: 'TV Shows',
		videogame: 'Video Games',
		anime: 'Anime',
		sports_league: 'Sports',
		animal: 'Animals',
		award_list: 'Award Lists',
		grammy: 'Grammy Awards',
		game_console: 'Game Consoles'
	};

	// Source labels
	const sourceLabels: Record<TriviaSource, string> = {
		thetriviaapi: 'Trivia API',
		wikipedia: 'Wikipedia'
	};

	// Source badge colors
	const sourceBadgeClasses: Record<TriviaSource, string> = {
		thetriviaapi: 'badge-info',
		wikipedia: 'badge-warning'
	};

	// Get all unique source types from loaded sources
	$effect(() => {
		// Reactive effect to track source types
	});

	// Filtered sources based on type and search
	let filteredSources = $derived.by(() => {
		let result = sources;

		if (sourceTypeFilter !== 'all') {
			result = result.filter((a) => a.sourceType === sourceTypeFilter);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((a) => a.title.toLowerCase().includes(query));
		}

		return result;
	});

	// Count selected trivia
	let selectedTriviaCount = $derived(fetchedTrivia.filter((t) => t.selected).length);

	onMount(async () => {
		sources = await getSourceCollection();
		isLoadingSources = false;
	});

	// Reset form
	function resetForm() {
		formQuestionText = '';
		formCorrectAnswer = '';
		formWrongAnswers = ['', ''];
		formDifficulty = '';
		isEditing = false;
		selectedQuestion = null;
	}

	// Select a source
	async function selectSource(source: Source) {
		if (selectedSource?.id === source.id) {
			// Deselect
			selectedSource = null;
			questions = [];
			resetForm();
			closeFetchPreview();
		} else {
			selectedSource = source;
			resetForm();
			closeFetchPreview();
			isLoadingQuestions = true;
			questions = await getQuestionsBySource(source.id);
			isLoadingQuestions = false;
		}
	}

	// Select a question for editing
	function selectQuestion(question: Question) {
		if (selectedQuestion?.id === question.id && !isEditing) {
			resetForm();
		} else {
			selectedQuestion = question;
			formQuestionText = question.questionText;
			formCorrectAnswer = question.correctAnswer;
			// Ensure we have at least 2 wrong answer slots
			formWrongAnswers = question.wrongAnswers.length >= 2
				? [...question.wrongAnswers]
				: [...question.wrongAnswers, ...Array(2 - question.wrongAnswers.length).fill('')];
			formDifficulty = question.difficulty || '';
			isEditing = true;
		}
	}

	// Add a new question
	async function addQuestion() {
		if (!selectedSource || !formQuestionText.trim() || !formCorrectAnswer.trim() || isSaving) return;

		isSaving = true;
		// Filter out empty wrong answers
		const wrongAnswers = formWrongAnswers.filter((a) => a.trim()).map((a) => a.trim());

		const question: Question = {
			id: crypto.randomUUID(),
			sourceId: selectedSource.id,
			questionText: formQuestionText.trim(),
			correctAnswer: formCorrectAnswer.trim(),
			wrongAnswers,
			difficulty: formDifficulty || undefined
		};

		const result = await addQuestionService(question);
		if (result) {
			questions = await getQuestionsBySource(selectedSource.id);
			resetForm();
		}
		isSaving = false;
	}

	// Update an existing question
	async function updateQuestion() {
		if (!selectedSource || !selectedQuestion || !formQuestionText.trim() || !formCorrectAnswer.trim() || isSaving) return;

		isSaving = true;
		// Filter out empty wrong answers
		const wrongAnswers = formWrongAnswers.filter((a) => a.trim()).map((a) => a.trim());

		const updatedQuestion: Question = {
			...selectedQuestion,
			questionText: formQuestionText.trim(),
			correctAnswer: formCorrectAnswer.trim(),
			wrongAnswers,
			difficulty: formDifficulty || undefined
		};

		const result = await updateQuestionService(updatedQuestion);
		if (result) {
			questions = await getQuestionsBySource(selectedSource.id);
			resetForm();
		}
		isSaving = false;
	}

	// Remove a question
	async function removeQuestion(question: Question, event: MouseEvent) {
		event.stopPropagation();
		if (!selectedSource) return;

		const success = await removeQuestionService(question);
		if (success) {
			questions = await getQuestionsBySource(selectedSource.id);
			if (selectedQuestion?.id === question.id) {
				resetForm();
			}
		}
	}

	// Handle form submission
	function handleSubmit() {
		if (isEditing) {
			updateQuestion();
		} else {
			addQuestion();
		}
	}

	// Check if form is valid (need question text, correct answer, and at least source selected)
	let isFormValid = $derived(
		formQuestionText.trim() &&
			formCorrectAnswer.trim() &&
			selectedSource
	);

	// Add a new wrong answer slot
	function addWrongAnswer() {
		formWrongAnswers = [...formWrongAnswers, ''];
	}

	// Remove a wrong answer slot
	function removeWrongAnswer(index: number) {
		if (formWrongAnswers.length > 1) {
			formWrongAnswers = formWrongAnswers.filter((_, i) => i !== index);
		}
	}

	// Update a wrong answer
	function updateWrongAnswer(index: number, value: string) {
		formWrongAnswers = formWrongAnswers.map((a, i) => (i === index ? value : a));
	}

	// Toggle source selection
	function toggleSource(source: TriviaSource) {
		if (fetchSources.includes(source)) {
			fetchSources = fetchSources.filter((s) => s !== source);
		} else {
			fetchSources = [...fetchSources, source];
		}
	}

	// Open fetch modal
	function openFetchModal() {
		showFetchModal = true;
		fetchErrors = [];
	}

	// Close fetch modal
	function closeFetchModal() {
		showFetchModal = false;
	}

	// Close fetch preview
	function closeFetchPreview() {
		showPreview = false;
		fetchedTrivia = [];
		fetchErrors = [];
	}

	// Fetch trivia from selected sources
	async function fetchTrivia() {
		if (!selectedSource || fetchSources.length === 0) return;

		isFetching = true;
		fetchErrors = [];

		try {
			const result = await fetchTriviaForSource(
				selectedSource,
				{
					sources: fetchSources,
					difficulty: fetchDifficulty || undefined,
					amount: fetchAmount
				}
			);

			fetchedTrivia = result.trivia;
			fetchErrors = result.errors;
			showPreview = true;
			showFetchModal = false;
		} catch (error) {
			console.error('Failed to fetch trivia:', error);
			fetchErrors = [{ source: 'thetriviaapi', message: 'Failed to fetch trivia' }];
		} finally {
			isFetching = false;
		}
	}

	// Toggle trivia selection
	function toggleTriviaSelection(trivia: FetchedTrivia) {
		fetchedTrivia = fetchedTrivia.map((t) =>
			t.id === trivia.id ? { ...t, selected: !t.selected } : t
		);
	}

	// Select all trivia
	function selectAllTrivia() {
		fetchedTrivia = fetchedTrivia.map((t) => ({ ...t, selected: true }));
	}

	// Deselect all trivia
	function deselectAllTrivia() {
		fetchedTrivia = fetchedTrivia.map((t) => ({ ...t, selected: false }));
	}

	// Import selected trivia
	async function importSelectedTrivia() {
		if (!selectedSource || selectedTriviaCount === 0) return;

		isImporting = true;

		try {
			const selectedItems = fetchedTrivia.filter((t) => t.selected);

			for (const trivia of selectedItems) {
				const question = convertToQuestion(trivia, selectedSource.id);
				await addQuestionService(question);
			}

			// Refresh questions
			questions = await getQuestionsBySource(selectedSource.id);
			closeFetchPreview();
		} catch (error) {
			console.error('Failed to import trivia:', error);
		} finally {
			isImporting = false;
		}
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Trivia Manager</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Sources List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Sources</h2>

				<!-- Filters -->
				<div class="space-y-2 mb-3">
					<input
						type="text"
						placeholder="Search sources..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
					/>
					<select
						class="select select-bordered select-sm w-full"
						bind:value={sourceTypeFilter}
					>
						<option value="all">All Types</option>
						{#each Object.entries(sourceTypeLabels) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if isLoadingSources}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if filteredSources.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No sources found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each filteredSources as source (source.id)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedSource?.id === source.id,
											'bg-base-100': selectedSource?.id !== source.id
										}
									)}
									onclick={() => selectSource(source)}
									onkeydown={(e) => e.key === 'Enter' && selectSource(source)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-center gap-2">
										{#if source.coverImage}
											<img
												src={source.coverImage}
												alt={source.title}
												class="w-8 h-8 rounded object-cover"
											/>
										{:else}
											<div class="w-8 h-8 rounded bg-base-300 flex items-center justify-center text-xs">
												?
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{source.title}</div>
											<div class="text-xs text-base-content/60">
												{sourceTypeLabels[source.sourceType]}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
					{filteredSources.length} source{filteredSources.length !== 1 ? 's' : ''}
				</div>
			</div>
		</div>

		<!-- Column 2: Questions List / Fetch Preview -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				{#if showPreview}
					<!-- Fetch Preview Mode -->
					<div class="flex items-center justify-between mb-2">
						<h2 class="card-title text-lg">
							Fetched Trivia
							<span class="text-sm font-normal text-base-content/60">
								({fetchedTrivia.length} found)
							</span>
						</h2>
						<button class="btn btn-ghost btn-sm" onclick={closeFetchPreview}>
							Cancel
						</button>
					</div>

					{#if fetchErrors.length > 0}
						<div class="alert alert-warning mb-2 py-2 text-sm">
							{#each fetchErrors as error}
								<span>{sourceLabels[error.source]}: {error.message}</span>
							{/each}
						</div>
					{/if}

					<div class="flex gap-2 mb-2">
						<button class="btn btn-xs btn-ghost" onclick={selectAllTrivia}>
							Select All
						</button>
						<button class="btn btn-xs btn-ghost" onclick={deselectAllTrivia}>
							Deselect All
						</button>
					</div>

					<div class="flex-1 overflow-y-auto">
						{#if fetchedTrivia.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p>No trivia found.</p>
								<p class="text-sm mt-1">Try different sources or search terms.</p>
							</div>
						{:else}
							<div class="space-y-2">
								{#each fetchedTrivia as trivia (trivia.id)}
									<div
										class={classNames(
											'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
											'hover:bg-base-300',
											{
												'bg-success/20 ring-2 ring-success': trivia.selected,
												'bg-base-100': !trivia.selected
											}
										)}
										onclick={() => toggleTriviaSelection(trivia)}
										onkeydown={(e) => e.key === 'Enter' && toggleTriviaSelection(trivia)}
										role="button"
										tabindex="0"
									>
										<div class="flex items-start gap-2">
											<input
												type="checkbox"
												class="checkbox checkbox-success checkbox-sm mt-1"
												checked={trivia.selected}
												onclick={(e) => e.stopPropagation()}
												onchange={() => toggleTriviaSelection(trivia)}
											/>
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 mb-1">
													<span class={classNames('badge badge-xs', sourceBadgeClasses[trivia.source])}>
														{sourceLabels[trivia.source]}
													</span>
													{#if trivia.difficulty}
														<span
															class={classNames('badge badge-xs', {
																'badge-success': trivia.difficulty === 'easy',
																'badge-warning': trivia.difficulty === 'medium',
																'badge-error': trivia.difficulty === 'hard'
															})}
														>
															{trivia.difficulty}
														</span>
													{/if}
												</div>
												<div class="font-medium text-sm line-clamp-2">
													{trivia.questionText}
												</div>
												<div class="text-xs text-base-content/60 mt-1">
													<span class="text-success">{trivia.correctAnswer}</span>
													{#each trivia.incorrectAnswers as wrong}
														<span class="mx-1">|</span>
														<span>{wrong}</span>
													{/each}
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="mt-2 pt-2 border-t border-base-300">
						<button
							class="btn btn-success w-full"
							onclick={importSelectedTrivia}
							disabled={selectedTriviaCount === 0 || isImporting}
						>
							{#if isImporting}
								<span class="loading loading-spinner loading-sm"></span>
								Importing...
							{:else}
								Import Selected ({selectedTriviaCount})
							{/if}
						</button>
					</div>
				{:else}
					<!-- Normal Questions List Mode -->
					<div class="flex items-center justify-between mb-2">
						<h2 class="card-title text-lg">
							Questions
							{#if selectedSource}
								<span class="text-sm font-normal text-base-content/60">
									for {selectedSource.title}
								</span>
							{/if}
						</h2>
						{#if selectedSource}
							<button class="btn btn-primary btn-sm" onclick={openFetchModal}>
								Fetch Trivia
							</button>
						{/if}
					</div>

					<div class="flex-1 overflow-y-auto">
						{#if !selectedSource}
							<div class="text-center text-base-content/60 p-4">
								<p>Select a source to view its questions.</p>
							</div>
						{:else if isLoadingQuestions}
							<div class="flex justify-center p-4">
								<span class="loading loading-spinner loading-md"></span>
							</div>
						{:else if questions.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p>No questions yet.</p>
								<p class="text-sm mt-1">Create questions using the form or fetch from APIs.</p>
							</div>
						{:else}
							<div class="space-y-2">
								{#each questions as question (question.id)}
									<div
										class={classNames(
											'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
											'hover:bg-base-300',
											{
												'bg-primary/20 ring-2 ring-primary': selectedQuestion?.id === question.id,
												'bg-base-100': selectedQuestion?.id !== question.id
											}
										)}
										onclick={() => selectQuestion(question)}
										onkeydown={(e) => e.key === 'Enter' && selectQuestion(question)}
										role="button"
										tabindex="0"
									>
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<div class="font-medium text-sm line-clamp-2">
													{question.questionText}
												</div>
												<div class="text-xs mt-1">
													<span class="text-success">{question.correctAnswer}</span>
													{#if question.wrongAnswers.length > 0}
														{#each question.wrongAnswers as wrong}
															<span class="mx-1 text-base-content/40">|</span>
															<span class="text-base-content/60">{wrong}</span>
														{/each}
													{/if}
												</div>
												{#if question.difficulty}
													<div class="mt-1">
														<span
															class={classNames('badge badge-xs', {
																'badge-success': question.difficulty === 'easy',
																'badge-warning': question.difficulty === 'medium',
																'badge-error': question.difficulty === 'hard'
															})}
														>
															{question.difficulty}
														</span>
													</div>
												{/if}
											</div>
											<button
												class="btn btn-ghost btn-xs text-error"
												onclick={(e) => removeQuestion(question, e)}
												title="Remove question"
											>
												✕
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					{#if selectedSource}
						<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
							{questions.length} question{questions.length !== 1 ? 's' : ''}
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Column 3: Question Form -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Question' : 'Add Question'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}> Cancel </button>
					{/if}
				</div>

				{#if !selectedSource}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a source to add questions.</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto">
						<div class="space-y-4">
							<!-- Question Text -->
							<div class="form-control">
								<label class="label" for="question-text">
									<span class="label-text">Question *</span>
								</label>
								<textarea
									id="question-text"
									placeholder="Enter your trivia question..."
									class="textarea textarea-bordered w-full h-20"
									bind:value={formQuestionText}
								></textarea>
							</div>

							<!-- Correct Answer -->
							<div class="form-control">
								<label class="label" for="correct-answer">
									<span class="label-text text-success font-semibold">Correct Answer *</span>
								</label>
								<input
									id="correct-answer"
									type="text"
									placeholder="The correct answer..."
									class="input input-bordered input-success w-full"
									bind:value={formCorrectAnswer}
								/>
							</div>

							<!-- Wrong Answers -->
							<div class="form-control">
								<div class="flex items-center justify-between mb-1">
									<label class="label py-0">
										<span class="label-text">Wrong Answers</span>
									</label>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={addWrongAnswer}
									>
										+ Add
									</button>
								</div>
								<div class="space-y-2">
									{#each formWrongAnswers as answer, index (index)}
										<div class="flex gap-2">
											<input
												type="text"
												placeholder="Wrong answer {index + 1}..."
												class="input input-bordered input-sm w-full"
												value={answer}
												oninput={(e) => updateWrongAnswer(index, e.currentTarget.value)}
											/>
											{#if formWrongAnswers.length > 1}
												<button
													type="button"
													class="btn btn-ghost btn-sm text-error"
													onclick={() => removeWrongAnswer(index)}
												>
													✕
												</button>
											{/if}
										</div>
									{/each}
								</div>
							</div>

							<!-- Difficulty -->
							<div class="form-control">
								<label class="label" for="difficulty">
									<span class="label-text">Difficulty (optional)</span>
								</label>
								<select
									id="difficulty"
									class="select select-bordered w-full"
									bind:value={formDifficulty}
								>
									<option value="">No difficulty set</option>
									<option value="easy">Easy</option>
									<option value="medium">Medium</option>
									<option value="hard">Hard</option>
								</select>
							</div>

							<!-- Submit button -->
							<button
								class="btn btn-primary w-full"
								onclick={handleSubmit}
								disabled={!isFormValid || isSaving}
							>
								{#if isSaving}
									<span class="loading loading-spinner loading-sm"></span>
									Saving...
								{:else}
									{isEditing ? 'Update Question' : 'Add Question'}
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Fetch Modal -->
{#if showFetchModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Fetch Trivia for "{selectedSource?.title}"</h3>

			<!-- Sources -->
			<div class="form-control mb-4">
				<label class="label">
					<span class="label-text font-medium">Sources</span>
				</label>
				<div class="space-y-2">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							checked={fetchSources.includes('thetriviaapi')}
							onchange={() => toggleSource('thetriviaapi')}
						/>
						<span class="label-text">The Trivia API</span>
						<span class="badge badge-info badge-xs">Category-based</span>
					</label>
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							checked={fetchSources.includes('wikipedia')}
							onchange={() => toggleSource('wikipedia')}
						/>
						<span class="label-text">Wikipedia</span>
						<span class="badge badge-warning badge-xs">Fact extraction</span>
					</label>
				</div>
			</div>

			<!-- Difficulty -->
			<div class="form-control mb-4">
				<label class="label" for="fetch-difficulty">
					<span class="label-text font-medium">Difficulty</span>
				</label>
				<select
					id="fetch-difficulty"
					class="select select-bordered w-full"
					bind:value={fetchDifficulty}
				>
					<option value="">Any difficulty</option>
					<option value="easy">Easy</option>
					<option value="medium">Medium</option>
					<option value="hard">Hard</option>
				</select>
			</div>

			<!-- Amount -->
			<div class="form-control mb-4">
				<label class="label" for="fetch-amount">
					<span class="label-text font-medium">Amount per source</span>
				</label>
				<input
					id="fetch-amount"
					type="number"
					min="1"
					max="20"
					class="input input-bordered w-full"
					bind:value={fetchAmount}
				/>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeFetchModal}>Cancel</button>
				<button
					class="btn btn-primary"
					onclick={fetchTrivia}
					disabled={fetchSources.length === 0 || isFetching}
				>
					{#if isFetching}
						<span class="loading loading-spinner loading-sm"></span>
						Fetching...
					{:else}
						Fetch Trivia
					{/if}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeFetchModal}></div>
	</div>
{/if}
