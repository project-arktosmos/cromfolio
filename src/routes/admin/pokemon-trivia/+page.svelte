<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import {
		getAllPokemonTriviaTemplatesV2,
		createPokemonTriviaTemplateV2,
		updatePokemonTriviaTemplateV2,
		deletePokemonTriviaTemplateV2
	} from '$services/pokemon-trivia-templates.service';
	import {
		type PokemonTriviaTemplateV2,
		type TemplateType,
		type TemplateCondition,
		type ScopeFilter,
		type ComparisonConfig,
		type Difficulty,
		TEMPLATE_TYPE_INFO,
		parseConditions,
		stringifyConditions,
		parseScopeFilters,
		stringifyScopeFilters,
		parseComparisonConfig,
		stringifyComparisonConfig
	} from '$types/pokemon-trivia-template.type';
	import {
		groupAttributesByCategory,
		requiresConditionBuilder,
		requiresComparisonConfig
	} from '$utils/pokemon-trivia';
	import TemplateTypeSelector from './components/TemplateTypeSelector.svelte';
	import ConditionBuilder from './components/ConditionBuilder.svelte';
	import ScopeFilterBuilder from './components/ScopeFilterBuilder.svelte';
	import ComparisonConfigBuilder from './components/ComparisonConfigBuilder.svelte';
	import TemplatePreview from './components/TemplatePreview.svelte';

	// Templates state
	let templates: PokemonTriviaTemplateV2[] = $state([]);
	let isLoading = $state(true);
	let isSaving = $state(false);

	// Selection state
	let selectedTemplate = $state<PokemonTriviaTemplateV2 | null>(null);
	let isEditing = $state(false);

	// Filter state
	let filterType = $state<TemplateType | 'all'>('all');
	let searchQuery = $state('');

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formTemplateType = $state<TemplateType>('simple_match');
	let formQuestionTemplate = $state('');
	let formAnswerTemplate = $state('');
	let formPrimaryAttribute = $state('type');
	let formConditions = $state<TemplateCondition[]>([]);
	let formConditionLogic = $state<'and' | 'or'>('and');
	let formScopeFilters = $state<ScopeFilter>({});
	let formComparisonConfig = $state<ComparisonConfig | null>(null);
	let formDifficulty = $state<Difficulty | ''>('');
	let formWeight = $state(100);
	let formIsActive = $state(true);

	// Filtered templates
	let filteredTemplates = $derived.by(() => {
		let result = templates;

		// Filter by type
		if (filterType !== 'all') {
			result = result.filter((t) => t.templateType === filterType);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.questionTemplate.toLowerCase().includes(query) ||
					t.primaryAttribute.toLowerCase().includes(query)
			);
		}

		return result;
	});

	// Template types present in templates (for filter dropdown)
	let availableTemplateTypes = $derived.by(() => {
		const types = new Set(templates.map((t) => t.templateType));
		return Array.from(types).sort();
	});

	// Show condition builder for certain template types
	let showConditionBuilder = $derived(requiresConditionBuilder(formTemplateType));

	// Show comparison config for superlative/comparison types
	let showComparisonConfig = $derived(requiresComparisonConfig(formTemplateType));

	// Show count selector for comparison type only
	let showComparisonCount = $derived(formTemplateType === 'comparison');

	onMount(async () => {
		await loadTemplates();
	});

	async function loadTemplates() {
		isLoading = true;
		templates = await getAllPokemonTriviaTemplatesV2();
		isLoading = false;
	}

	function resetForm() {
		formName = '';
		formDescription = '';
		formTemplateType = 'simple_match';
		formQuestionTemplate = '';
		formAnswerTemplate = '';
		formPrimaryAttribute = 'type';
		formConditions = [];
		formConditionLogic = 'and';
		formScopeFilters = {};
		formComparisonConfig = null;
		formDifficulty = '';
		formWeight = 100;
		formIsActive = true;
		isEditing = false;
		selectedTemplate = null;
	}

	function selectTemplate(template: PokemonTriviaTemplateV2) {
		if (selectedTemplate?.id === template.id && !isEditing) {
			resetForm();
		} else {
			selectedTemplate = template;
			formName = template.name;
			formDescription = template.description;
			formTemplateType = template.templateType as TemplateType;
			formQuestionTemplate = template.questionTemplate;
			formAnswerTemplate = template.answerTemplate;
			formPrimaryAttribute = template.primaryAttribute;
			formConditions = parseConditions(template.conditions);
			formConditionLogic = template.conditionLogic;
			formScopeFilters = parseScopeFilters(template.scopeFilters);
			formComparisonConfig = parseComparisonConfig(template.comparisonConfig);
			formDifficulty = (template.difficulty as Difficulty) || '';
			formWeight = template.weight;
			formIsActive = template.isActive;
			isEditing = true;
		}
	}

	async function handleSubmit() {
		if (
			!formName.trim() ||
			!formQuestionTemplate.trim() ||
			!formAnswerTemplate.trim() ||
			isSaving
		) {
			return;
		}

		isSaving = true;

		try {
			const templateData = {
				name: formName.trim(),
				description: formDescription.trim(),
				templateType: formTemplateType,
				questionTemplate: formQuestionTemplate.trim(),
				answerTemplate: formAnswerTemplate.trim(),
				primaryAttribute: formPrimaryAttribute,
				conditions: stringifyConditions(formConditions),
				conditionLogic: formConditionLogic,
				scopeFilters: stringifyScopeFilters(formScopeFilters),
				comparisonConfig: stringifyComparisonConfig(formComparisonConfig),
				difficulty: formDifficulty || undefined,
				weight: formWeight,
				isActive: formIsActive
			};

			if (isEditing && selectedTemplate) {
				const updated = await updatePokemonTriviaTemplateV2({
					...selectedTemplate,
					...templateData
				});

				if (updated) {
					await loadTemplates();
					resetForm();
				}
			} else {
				const created = await createPokemonTriviaTemplateV2(templateData);

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

	async function handleDelete(template: PokemonTriviaTemplateV2, event: MouseEvent) {
		event.stopPropagation();

		if (!confirm(`Delete template "${template.name}"?`)) return;

		const success = await deletePokemonTriviaTemplateV2(template.id);
		if (success) {
			await loadTemplates();
			if (selectedTemplate?.id === template.id) {
				resetForm();
			}
		}
	}

	async function toggleActive(template: PokemonTriviaTemplateV2, event: MouseEvent) {
		event.stopPropagation();

		const updated = await updatePokemonTriviaTemplateV2({
			...template,
			isActive: !template.isActive
		});

		if (updated) {
			await loadTemplates();
		}
	}

	// Check if form is valid
	let isFormValid = $derived(
		formName.trim() && formQuestionTemplate.trim() && formAnswerTemplate.trim()
	);

	// Get grouped attributes for dropdown
	const attributesByCategory = groupAttributesByCategory();
</script>

<div class="flex h-full flex-col">
	<h1 class="mb-4 text-2xl font-bold">Pokemon Trivia Templates</h1>

	<div class="grid min-h-0 flex-1 grid-cols-3 gap-4">
		<!-- Column 1: Templates List -->
		<div class="card bg-base-200 flex flex-col overflow-hidden">
			<div class="card-body flex h-full flex-col p-4">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="card-title text-lg">Templates</h2>
					<span class="text-base-content/60 text-sm"
						>{filteredTemplates.length} / {templates.length}</span
					>
				</div>

				<!-- Search and Filter -->
				<div class="mb-3 space-y-2">
					<input
						type="text"
						class="input input-bordered input-sm w-full"
						placeholder="Search templates..."
						bind:value={searchQuery}
					/>
					<select class="select select-bordered select-sm w-full" bind:value={filterType}>
						<option value="all">All Types</option>
						{#each availableTemplateTypes as type}
							<option value={type}>
								{TEMPLATE_TYPE_INFO[type as TemplateType]?.icon ?? ''}
								{TEMPLATE_TYPE_INFO[type as TemplateType]?.label ?? type}
							</option>
						{/each}
					</select>
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if filteredTemplates.length === 0}
						<div class="text-base-content/60 p-4 text-center">
							<p>No templates found.</p>
							<p class="mt-1 text-sm">Create templates using the form.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each filteredTemplates as template (template.id)}
								<div
									class={classNames(
										'w-full cursor-pointer rounded-lg p-3 text-left transition-colors',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-primary ring-2': selectedTemplate?.id === template.id,
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
										<div class="min-w-0 flex-1">
											<div class="mb-1 flex flex-wrap items-center gap-2">
												<span class="badge badge-primary badge-sm">
													{TEMPLATE_TYPE_INFO[template.templateType as TemplateType]?.icon ?? ''}
													{TEMPLATE_TYPE_INFO[template.templateType as TemplateType]?.label ??
														template.templateType}
												</span>
												<span class="badge badge-ghost badge-sm">{template.primaryAttribute}</span>
												{#if template.difficulty}
													<span class="badge badge-outline badge-xs">{template.difficulty}</span>
												{/if}
												{#if !template.isActive}
													<span class="badge badge-warning badge-xs">inactive</span>
												{/if}
											</div>
											<div class="truncate text-sm font-medium">{template.name}</div>
											<div class="text-base-content/60 mt-1 line-clamp-1 text-xs">
												{template.questionTemplate}
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

		<!-- Column 2 & 3: Editor -->
		<div class="card bg-base-200 col-span-2 flex flex-col overflow-hidden">
			<div class="card-body flex h-full flex-col p-4">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Template' : 'New Template'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}>Cancel</button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<!-- Template Type Selector -->
						<TemplateTypeSelector
							value={formTemplateType}
							onchange={(v) => (formTemplateType = v)}
							disabled={isSaving}
						/>

						<!-- Basic Info -->
						<div class="grid grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="name">
									<span class="label-text font-semibold">Name *</span>
								</label>
								<input
									id="name"
									type="text"
									placeholder="e.g., Pokemon Type Question"
									class="input input-bordered w-full"
									bind:value={formName}
									disabled={isSaving}
								/>
							</div>
							<div class="form-control">
								<label class="label" for="primary-attribute">
									<span class="label-text font-semibold">Primary Attribute</span>
								</label>
								<select
									id="primary-attribute"
									class="select select-bordered w-full"
									bind:value={formPrimaryAttribute}
									disabled={isSaving}
								>
									{#each Object.entries(attributesByCategory) as [category, attrs]}
										<optgroup label={category}>
											{#each attrs as [key, info]}
												<option value={key}>{info.label}</option>
											{/each}
										</optgroup>
									{/each}
								</select>
							</div>
						</div>

						<!-- Description -->
						<div class="form-control">
							<label class="label" for="description">
								<span class="label-text font-semibold">Description</span>
							</label>
							<input
								id="description"
								type="text"
								placeholder="Optional description of what this template generates"
								class="input input-bordered w-full"
								bind:value={formDescription}
								disabled={isSaving}
							/>
						</div>

						<!-- Question/Answer Templates -->
						<div class="grid grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="question-template">
									<span class="label-text font-semibold">Question Template *</span>
								</label>
								<textarea
									id="question-template"
									placeholder={'What type is {name}?'}
									class="textarea textarea-bordered h-20 w-full"
									bind:value={formQuestionTemplate}
									disabled={isSaving}
								></textarea>
								<label class="label">
									<span class="label-text-alt text-base-content/60">
										Use {'{name}'}, {'{type}'}, {'{ability}'}, etc.
									</span>
								</label>
							</div>
							<div class="form-control">
								<label class="label" for="answer-template">
									<span class="label-text text-success font-semibold">Answer Template *</span>
								</label>
								<textarea
									id="answer-template"
									placeholder={'{type}'}
									class="textarea textarea-bordered textarea-success h-20 w-full"
									bind:value={formAnswerTemplate}
									disabled={isSaving}
								></textarea>
								<label class="label">
									<span class="label-text-alt text-base-content/60">
										Usually {'{name}'} or the attribute value
									</span>
								</label>
							</div>
						</div>

						<!-- Condition Builder (conditional) -->
						{#if showConditionBuilder}
							<ConditionBuilder
								conditions={formConditions}
								conditionLogic={formConditionLogic}
								onConditionsChange={(c) => (formConditions = c)}
								onLogicChange={(l) => (formConditionLogic = l)}
								disabled={isSaving}
							/>
						{/if}

						<!-- Comparison Config (conditional) -->
						{#if showComparisonConfig}
							<ComparisonConfigBuilder
								config={formComparisonConfig}
								onchange={(c) => (formComparisonConfig = c)}
								showCount={showComparisonCount}
								disabled={isSaving}
							/>
						{/if}

						<!-- Scope Filters -->
						<ScopeFilterBuilder
							scopeFilters={formScopeFilters}
							onchange={(f) => (formScopeFilters = f)}
							disabled={isSaving}
						/>

						<!-- Settings -->
						<div class="grid grid-cols-3 gap-4">
							<div class="form-control">
								<label class="label" for="difficulty">
									<span class="label-text font-semibold">Difficulty</span>
								</label>
								<select
									id="difficulty"
									class="select select-bordered w-full"
									bind:value={formDifficulty}
									disabled={isSaving}
								>
									<option value="">Any</option>
									<option value="easy">Easy</option>
									<option value="medium">Medium</option>
									<option value="hard">Hard</option>
								</select>
							</div>
							<div class="form-control">
								<label class="label" for="weight">
									<span class="label-text font-semibold">Weight</span>
								</label>
								<input
									id="weight"
									type="number"
									class="input input-bordered w-full"
									bind:value={formWeight}
									min="1"
									max="1000"
									disabled={isSaving}
								/>
								<label class="label">
									<span class="label-text-alt text-base-content/60">Higher = more likely</span>
								</label>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer justify-start gap-3">
									<input
										type="checkbox"
										class="toggle toggle-success"
										bind:checked={formIsActive}
										disabled={isSaving}
									/>
									<span class="label-text font-semibold">Active</span>
								</label>
							</div>
						</div>

						<!-- Live Preview -->
						<TemplatePreview
							templateType={formTemplateType}
							questionTemplate={formQuestionTemplate}
							answerTemplate={formAnswerTemplate}
							primaryAttribute={formPrimaryAttribute}
						/>

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
			</div>
		</div>
	</div>
</div>
