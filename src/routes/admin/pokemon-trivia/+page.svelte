<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import {
		getAllPokemonTriviaTemplates,
		createPokemonTriviaTemplate,
		updatePokemonTriviaTemplate,
		deletePokemonTriviaTemplate
	} from '$services/pokemon-trivia-templates.service';
	import { getPokemonCommonTagKeys } from '$services/tags.service';
	import type { PokemonTriviaTemplate } from '$types/pokemon-trivia-template.type';

	// Templates state
	let templates: PokemonTriviaTemplate[] = $state([]);
	let isLoading = $state(true);
	let isSaving = $state(false);

	// Tag keys that are available for Pokemon (derived from all tags)
	let availableTagKeys: string[] = $state([]);
	let isLoadingTags = $state(true);

	// Selection state
	let selectedTemplate = $state<PokemonTriviaTemplate | null>(null);

	// Form state
	let isEditing = $state(false);
	let formTagKey = $state('');
	let formQuestionTemplate = $state('');
	let formAnswerTemplate = $state('');
	let formIsActive = $state(true);

	// Filter state
	let filterTagKey = $state<string | 'all'>('all');

	// Filtered templates
	let filteredTemplates = $derived.by(() => {
		if (filterTagKey === 'all') return templates;
		return templates.filter((t) => t.tagKey === filterTagKey);
	});

	// Get unique tag keys from templates (for filter dropdown)
	let templateTagKeys = $derived.by(() => {
		const keys = new Set(templates.map((t) => t.tagKey));
		return Array.from(keys).sort();
	});

	onMount(async () => {
		await Promise.all([loadTemplates(), loadTagKeys()]);
	});

	async function loadTemplates() {
		isLoading = true;
		templates = await getAllPokemonTriviaTemplates();
		isLoading = false;
	}

	async function loadTagKeys() {
		isLoadingTags = true;
		try {
			// Get tag keys that are common to ALL Pokemon stickers
			availableTagKeys = await getPokemonCommonTagKeys();
		} catch (e) {
			console.error('Failed to load tag keys:', e);
		}
		isLoadingTags = false;
	}

	function resetForm() {
		formTagKey = '';
		formQuestionTemplate = '';
		formAnswerTemplate = '';
		formIsActive = true;
		isEditing = false;
		selectedTemplate = null;
	}

	function selectTemplate(template: PokemonTriviaTemplate) {
		if (selectedTemplate?.id === template.id && !isEditing) {
			resetForm();
		} else {
			selectedTemplate = template;
			formTagKey = template.tagKey;
			formQuestionTemplate = template.questionTemplate;
			formAnswerTemplate = template.answerTemplate;
			formIsActive = template.isActive;
			isEditing = true;
		}
	}

	async function handleSubmit() {
		if (!formTagKey || !formQuestionTemplate.trim() || !formAnswerTemplate.trim() || isSaving) {
			return;
		}

		isSaving = true;

		try {
			if (isEditing && selectedTemplate) {
				// Update existing
				const updated = await updatePokemonTriviaTemplate({
					...selectedTemplate,
					tagKey: formTagKey,
					questionTemplate: formQuestionTemplate.trim(),
					answerTemplate: formAnswerTemplate.trim(),
					isActive: formIsActive
				});

				if (updated) {
					await loadTemplates();
					resetForm();
				}
			} else {
				// Create new
				const created = await createPokemonTriviaTemplate({
					tagKey: formTagKey,
					questionTemplate: formQuestionTemplate.trim(),
					answerTemplate: formAnswerTemplate.trim(),
					isActive: formIsActive
				});

				if (created) {
					await loadTemplates();
					resetForm();
				}
			}
		} catch (e) {
			console.error('Failed to save template:', e);
		}

		isSaving = false;
	}

	async function handleDelete(template: PokemonTriviaTemplate, event: MouseEvent) {
		event.stopPropagation();

		if (!confirm(`Delete template for "${template.tagKey}"?`)) return;

		const success = await deletePokemonTriviaTemplate(template.id);
		if (success) {
			await loadTemplates();
			if (selectedTemplate?.id === template.id) {
				resetForm();
			}
		}
	}

	async function toggleActive(template: PokemonTriviaTemplate, event: MouseEvent) {
		event.stopPropagation();

		const updated = await updatePokemonTriviaTemplate({
			...template,
			isActive: !template.isActive
		});

		if (updated) {
			await loadTemplates();
		}
	}

	// Check if form is valid
	let isFormValid = $derived(
		formTagKey && formQuestionTemplate.trim() && formAnswerTemplate.trim()
	);

	// Preview the template with example values
	let previewQuestion = $derived.by(() => {
		if (!formQuestionTemplate) return '';
		return formQuestionTemplate
			.replace(/{name}/g, 'Pikachu')
			.replace(/{type}/g, 'Electric')
			.replace(/{ability}/g, 'Static')
			.replace(/{generation}/g, 'gen-1')
			.replace(/{[^}]+}/g, '???');
	});

	let previewAnswer = $derived.by(() => {
		if (!formAnswerTemplate) return '';
		return formAnswerTemplate
			.replace(/{name}/g, 'Pikachu')
			.replace(/{type}/g, 'Electric')
			.replace(/{ability}/g, 'Static')
			.replace(/{generation}/g, 'gen-1')
			.replace(/{[^}]+}/g, '???');
	});
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Pokemon Trivia Templates</h1>

	<div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
		<!-- Column 1: Templates List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">Templates</h2>
					<span class="text-sm text-base-content/60">{templates.length} total</span>
				</div>

				<!-- Filter by tag key -->
				<div class="mb-3">
					<select class="select select-bordered select-sm w-full" bind:value={filterTagKey}>
						<option value="all">All Tag Keys</option>
						{#each templateTagKeys as key}
							<option value={key}>{key}</option>
						{/each}
					</select>
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if filteredTemplates.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No templates yet.</p>
							<p class="text-sm mt-1">Create templates using the form.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each filteredTemplates as template (template.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedTemplate?.id === template.id,
											'bg-base-100': selectedTemplate?.id !== template.id,
											'opacity-50': !template.isActive
										}
									)}
									onclick={() => selectTemplate(template)}
									onkeydown={(e) => e.key === 'Enter' && selectTemplate(template)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1">
												<span class="badge badge-primary badge-sm">{template.tagKey}</span>
												{#if !template.isActive}
													<span class="badge badge-ghost badge-xs">inactive</span>
												{/if}
											</div>
											<div class="font-medium text-sm line-clamp-2">
												{template.questionTemplate}
											</div>
											<div class="text-xs text-success mt-1">
												→ {template.answerTemplate}
											</div>
										</div>
										<div class="flex flex-col gap-1">
											<button
												class={classNames('btn btn-ghost btn-xs', {
													'text-success': template.isActive,
													'text-base-content/40': !template.isActive
												})}
												onclick={(e) => toggleActive(template, e)}
												title={template.isActive ? 'Deactivate' : 'Activate'}
											>
												{template.isActive ? '✓' : '○'}
											</button>
											<button
												class="btn btn-ghost btn-xs text-error"
												onclick={(e) => handleDelete(template, e)}
												title="Delete template"
											>
												✕
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Form -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Template' : 'New Template'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}>Cancel</button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<!-- Tag Key -->
						<div class="form-control">
							<label class="label" for="tag-key">
								<span class="label-text font-semibold">Tag Key *</span>
							</label>
							{#if isLoadingTags}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<select
									id="tag-key"
									class="select select-bordered w-full"
									bind:value={formTagKey}
								>
									<option value="">Select a tag key...</option>
									{#each availableTagKeys as key}
										<option value={key}>{key}</option>
									{/each}
								</select>
							{/if}
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									The tag category this template targets (e.g., "type", "ability")
								</span>
							</label>
						</div>

						<!-- Question Template -->
						<div class="form-control">
							<label class="label" for="question-template">
								<span class="label-text font-semibold">Question Template *</span>
							</label>
							<textarea
								id="question-template"
								placeholder={'What type is {name}?'}
								class="textarea textarea-bordered w-full h-20"
								bind:value={formQuestionTemplate}
							></textarea>
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									Use {'{name}'} for Pokemon name, {'{type}'}, {'{ability}'}, etc.
								</span>
							</label>
						</div>

						<!-- Answer Template -->
						<div class="form-control">
							<label class="label" for="answer-template">
								<span class="label-text font-semibold text-success">Answer Template *</span>
							</label>
							<input
								id="answer-template"
								type="text"
								placeholder={'{type}'}
								class="input input-bordered input-success w-full"
								bind:value={formAnswerTemplate}
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									The value that will be the correct answer (e.g., {'{type}'})
								</span>
							</label>
						</div>

						<!-- Preview -->
						{#if formQuestionTemplate || formAnswerTemplate}
							<div class="bg-base-300 rounded-lg p-3">
								<div class="text-xs text-base-content/60 mb-1">Preview (with Pikachu)</div>
								<div class="font-medium text-sm">{previewQuestion}</div>
								<div class="text-sm text-success mt-1">→ {previewAnswer}</div>
							</div>
						{/if}

						<!-- Is Active -->
						<div class="form-control">
							<label class="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									class="toggle toggle-success"
									bind:checked={formIsActive}
								/>
								<span class="label-text">Active</span>
							</label>
							<label class="label pt-0">
								<span class="label-text-alt text-base-content/60">
									Inactive templates won't be used for question generation
								</span>
							</label>
						</div>

						<!-- Submit -->
						<button
							class="btn btn-primary w-full"
							onclick={handleSubmit}
							disabled={!isFormValid || isSaving}
						>
							{#if isSaving}
								<span class="loading loading-spinner loading-sm"></span>
								Saving...
							{:else}
								{isEditing ? 'Update Template' : 'Create Template'}
							{/if}
						</button>
					</div>
				</div>

				<!-- Help section -->
				<div class="mt-4 pt-4 border-t border-base-300">
					<div class="collapse collapse-arrow bg-base-100 rounded-lg">
						<input type="checkbox" />
						<div class="collapse-title text-sm font-medium">Available Placeholders</div>
						<div class="collapse-content">
							<div class="text-xs space-y-1">
								<div><code class="text-primary">{'{name}'}</code> - Pokemon name</div>
								<div><code class="text-primary">{'{type}'}</code> - Pokemon type</div>
								<div><code class="text-primary">{'{ability}'}</code> - Pokemon ability</div>
								<div><code class="text-primary">{'{hidden-ability}'}</code> - Hidden ability</div>
								<div><code class="text-primary">{'{generation}'}</code> - Generation</div>
								<div><code class="text-primary">{'{bst-tier}'}</code> - Base stat tier</div>
								<div><code class="text-primary">{'{weight-class}'}</code> - Weight class</div>
								<div><code class="text-primary">{'{height-class}'}</code> - Height class</div>
								<div>
									<code class="text-primary">{'{catch-difficulty}'}</code> - Catch difficulty
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
