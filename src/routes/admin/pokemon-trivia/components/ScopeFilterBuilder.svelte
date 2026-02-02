<script lang="ts">
	import { POKEMON_ATTRIBUTES, type ScopeFilter } from '$types/pokemon-trivia-template.type';

	interface Props {
		scopeFilters: ScopeFilter;
		onchange: (filters: ScopeFilter) => void;
		disabled?: boolean;
	}

	let { scopeFilters, onchange, disabled = false }: Props = $props();

	// Common scope filter options (most useful for restricting question pool)
	const scopeOptions = [
		{ key: 'generation', label: 'Generation', placeholder: '1, 2, 3...' },
		{ key: 'type', label: 'Type', placeholder: 'fire, water...' },
		{ key: 'legendary', label: 'Legendary', placeholder: 'true or false' }
	];

	function updateFilter(key: string, value: string) {
		const newFilters = { ...scopeFilters };
		if (value.trim() === '') {
			delete newFilters[key];
		} else {
			newFilters[key] = value.trim();
		}
		onchange(newFilters);
	}
</script>

<div class="bg-base-300 rounded-lg p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="font-semibold text-sm">Scope Filters</h3>
		<span class="text-xs text-base-content/60">Restrict Pokemon pool</span>
	</div>

	<div class="space-y-2">
		{#each scopeOptions as option}
			<div class="flex gap-2 items-center">
				<label class="w-24 text-sm text-base-content/80">{option.label}</label>
				<input
					type="text"
					class="input input-sm input-bordered flex-1"
					placeholder={option.placeholder}
					value={scopeFilters[option.key] ?? ''}
					oninput={(e) => updateFilter(option.key, e.currentTarget.value)}
					{disabled}
				/>
			</div>
		{/each}
	</div>

	<p class="text-xs text-base-content/50 mt-3">
		Leave empty to include all Pokemon. Use these to limit questions to specific subsets.
	</p>
</div>
