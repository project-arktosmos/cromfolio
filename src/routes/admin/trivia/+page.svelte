<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAlbumCollection } from '$services/albums.service';
	import {
		getQuestionsByAlbum,
		addQuestion as addQuestionService,
		updateQuestion as updateQuestionService,
		removeQuestion as removeQuestionService
	} from '$services/questions.service';
	import type { Album, AlbumType } from '$types/album.type';
	import type { Question, CorrectAnswer, Difficulty } from '$types/question.type';

	// Collection state
	let albums: Album[] = $state([]);
	let questions: Question[] = $state([]);
	let isLoadingAlbums = $state(true);
	let isLoadingQuestions = $state(false);
	let isSaving = $state(false);

	// Selection state
	let selectedAlbum = $state<Album | null>(null);
	let selectedQuestion = $state<Question | null>(null);

	// Filter state
	let albumTypeFilter = $state<AlbumType | 'all'>('all');
	let searchQuery = $state('');

	// Form state
	let isEditing = $state(false);
	let formQuestionText = $state('');
	let formAnswerA = $state('');
	let formAnswerB = $state('');
	let formAnswerC = $state('');
	let formCorrectAnswer = $state<CorrectAnswer>('a');
	let formDifficulty = $state<Difficulty | ''>('');

	// Album type labels for display
	const albumTypeLabels: Record<AlbumType, string> = {
		movie: 'Movies',
		tv: 'TV Shows',
		videogame: 'Video Games',
		anime: 'Anime',
		sports_league: 'Sports',
		animal: 'Animals',
		musician: 'Musicians',
		author: 'Authors'
	};

	// Get all unique album types from loaded albums
	$effect(() => {
		// Reactive effect to track album types
	});

	// Filtered albums based on type and search
	let filteredAlbums = $derived.by(() => {
		let result = albums;

		if (albumTypeFilter !== 'all') {
			result = result.filter((a) => a.albumType === albumTypeFilter);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((a) => a.title.toLowerCase().includes(query));
		}

		return result;
	});

	onMount(async () => {
		albums = await getAlbumCollection();
		isLoadingAlbums = false;
	});

	// Reset form
	function resetForm() {
		formQuestionText = '';
		formAnswerA = '';
		formAnswerB = '';
		formAnswerC = '';
		formCorrectAnswer = 'a';
		formDifficulty = '';
		isEditing = false;
		selectedQuestion = null;
	}

	// Select an album
	async function selectAlbum(album: Album) {
		if (selectedAlbum?.id === album.id) {
			// Deselect
			selectedAlbum = null;
			questions = [];
			resetForm();
		} else {
			selectedAlbum = album;
			resetForm();
			isLoadingQuestions = true;
			questions = await getQuestionsByAlbum(album.id);
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
			formAnswerA = question.answerA;
			formAnswerB = question.answerB;
			formAnswerC = question.answerC;
			formCorrectAnswer = question.correctAnswer;
			formDifficulty = question.difficulty || '';
			isEditing = true;
		}
	}

	// Add a new question
	async function addQuestion() {
		if (!selectedAlbum || !formQuestionText.trim() || isSaving) return;
		if (!formAnswerA.trim() || !formAnswerB.trim() || !formAnswerC.trim()) return;

		isSaving = true;
		const question: Question = {
			id: crypto.randomUUID(),
			albumId: selectedAlbum.id,
			questionText: formQuestionText.trim(),
			answerA: formAnswerA.trim(),
			answerB: formAnswerB.trim(),
			answerC: formAnswerC.trim(),
			correctAnswer: formCorrectAnswer,
			difficulty: formDifficulty || undefined
		};

		const result = await addQuestionService(question);
		if (result) {
			questions = await getQuestionsByAlbum(selectedAlbum.id);
			resetForm();
		}
		isSaving = false;
	}

	// Update an existing question
	async function updateQuestion() {
		if (!selectedAlbum || !selectedQuestion || !formQuestionText.trim() || isSaving) return;
		if (!formAnswerA.trim() || !formAnswerB.trim() || !formAnswerC.trim()) return;

		isSaving = true;
		const updatedQuestion: Question = {
			...selectedQuestion,
			questionText: formQuestionText.trim(),
			answerA: formAnswerA.trim(),
			answerB: formAnswerB.trim(),
			answerC: formAnswerC.trim(),
			correctAnswer: formCorrectAnswer,
			difficulty: formDifficulty || undefined
		};

		const result = await updateQuestionService(updatedQuestion);
		if (result) {
			questions = await getQuestionsByAlbum(selectedAlbum.id);
			resetForm();
		}
		isSaving = false;
	}

	// Remove a question
	async function removeQuestion(question: Question, event: MouseEvent) {
		event.stopPropagation();
		if (!selectedAlbum) return;

		const success = await removeQuestionService(question);
		if (success) {
			questions = await getQuestionsByAlbum(selectedAlbum.id);
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

	// Check if form is valid
	let isFormValid = $derived(
		formQuestionText.trim() &&
			formAnswerA.trim() &&
			formAnswerB.trim() &&
			formAnswerC.trim() &&
			selectedAlbum
	);

	// Get answer label color based on correct answer
	function getAnswerLabelClass(answer: CorrectAnswer): string {
		return formCorrectAnswer === answer ? 'text-success font-semibold' : '';
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Trivia Manager</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Albums List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Albums</h2>

				<!-- Filters -->
				<div class="space-y-2 mb-3">
					<input
						type="text"
						placeholder="Search albums..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
					/>
					<select
						class="select select-bordered select-sm w-full"
						bind:value={albumTypeFilter}
					>
						<option value="all">All Types</option>
						{#each Object.entries(albumTypeLabels) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if isLoadingAlbums}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if filteredAlbums.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No albums found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each filteredAlbums as album (album.id)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedAlbum?.id === album.id,
											'bg-base-100': selectedAlbum?.id !== album.id
										}
									)}
									onclick={() => selectAlbum(album)}
									onkeydown={(e) => e.key === 'Enter' && selectAlbum(album)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-center gap-2">
										{#if album.coverImage}
											<img
												src={album.coverImage}
												alt={album.title}
												class="w-8 h-8 rounded object-cover"
											/>
										{:else}
											<div class="w-8 h-8 rounded bg-base-300 flex items-center justify-center text-xs">
												?
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{album.title}</div>
											<div class="text-xs text-base-content/60">
												{albumTypeLabels[album.albumType]}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
					{filteredAlbums.length} album{filteredAlbums.length !== 1 ? 's' : ''}
				</div>
			</div>
		</div>

		<!-- Column 2: Questions List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">
					Questions
					{#if selectedAlbum}
						<span class="text-sm font-normal text-base-content/60">
							for {selectedAlbum.title}
						</span>
					{/if}
				</h2>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedAlbum}
						<div class="text-center text-base-content/60 p-4">
							<p>Select an album to view its questions.</p>
						</div>
					{:else if isLoadingQuestions}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if questions.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No questions yet.</p>
							<p class="text-sm mt-1">Create questions using the form on the right.</p>
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
											<div class="text-xs text-base-content/60 mt-1">
												<span class={question.correctAnswer === 'a' ? 'text-success' : ''}>
													A: {question.answerA}
												</span>
												<span class="mx-1">|</span>
												<span class={question.correctAnswer === 'b' ? 'text-success' : ''}>
													B: {question.answerB}
												</span>
												<span class="mx-1">|</span>
												<span class={question.correctAnswer === 'c' ? 'text-success' : ''}>
													C: {question.answerC}
												</span>
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

				{#if selectedAlbum}
					<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
						{questions.length} question{questions.length !== 1 ? 's' : ''}
					</div>
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

				{#if !selectedAlbum}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select an album to add questions.</p>
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

							<!-- Answer A -->
							<div class="form-control">
								<label class="label" for="answer-a">
									<span class={classNames('label-text', getAnswerLabelClass('a'))}>
										Answer A *
										{#if formCorrectAnswer === 'a'}
											<span class="badge badge-success badge-xs ml-1">Correct</span>
										{/if}
									</span>
								</label>
								<input
									id="answer-a"
									type="text"
									placeholder="First answer option..."
									class="input input-bordered w-full"
									bind:value={formAnswerA}
								/>
							</div>

							<!-- Answer B -->
							<div class="form-control">
								<label class="label" for="answer-b">
									<span class={classNames('label-text', getAnswerLabelClass('b'))}>
										Answer B *
										{#if formCorrectAnswer === 'b'}
											<span class="badge badge-success badge-xs ml-1">Correct</span>
										{/if}
									</span>
								</label>
								<input
									id="answer-b"
									type="text"
									placeholder="Second answer option..."
									class="input input-bordered w-full"
									bind:value={formAnswerB}
								/>
							</div>

							<!-- Answer C -->
							<div class="form-control">
								<label class="label" for="answer-c">
									<span class={classNames('label-text', getAnswerLabelClass('c'))}>
										Answer C *
										{#if formCorrectAnswer === 'c'}
											<span class="badge badge-success badge-xs ml-1">Correct</span>
										{/if}
									</span>
								</label>
								<input
									id="answer-c"
									type="text"
									placeholder="Third answer option..."
									class="input input-bordered w-full"
									bind:value={formAnswerC}
								/>
							</div>

							<!-- Correct Answer -->
							<div class="form-control">
								<label class="label">
									<span class="label-text">Correct Answer *</span>
								</label>
								<div class="flex gap-4">
									<label class="label cursor-pointer gap-2">
										<input
											type="radio"
											name="correct-answer"
											class="radio radio-success"
											value="a"
											bind:group={formCorrectAnswer}
										/>
										<span class="label-text">A</span>
									</label>
									<label class="label cursor-pointer gap-2">
										<input
											type="radio"
											name="correct-answer"
											class="radio radio-success"
											value="b"
											bind:group={formCorrectAnswer}
										/>
										<span class="label-text">B</span>
									</label>
									<label class="label cursor-pointer gap-2">
										<input
											type="radio"
											name="correct-answer"
											class="radio radio-success"
											value="c"
											bind:group={formCorrectAnswer}
										/>
										<span class="label-text">C</span>
									</label>
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
