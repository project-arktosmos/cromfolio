<script lang="ts">
	import classNames from 'classnames';
	import { POKEMON_ATTRIBUTES, type ComparisonConfig } from '$types/pokemon-trivia-template.type';
	import { getNumericAttributesByCategory } from '$utils/pokemon-trivia';

	interface Props {
		config: ComparisonConfig | null;
		onchange: (config: ComparisonConfig | null) => void;
		showCount?: boolean;
		disabled?: boolean;
	}

	let { config, onchange, showCount = false, disabled = false }: Props = $props();

	const attributesByCategory = getNumericAttributesByCategory();

	function updateConfig(updates: Partial<ComparisonConfig>) {
		if (!config) {
			onchange({
				operator: 'max',
				attribute: 'attack',
				count: 2,
				...updates
			});
		} else {
			onchange({ ...config, ...updates });
		}
	}

	function initConfig() {
		onchange({
			operator: 'max',
			attribute: 'attack',
			count: 2
		});
	}

	function clearConfig() {
		onchange(null);
	}
</script>

<div class="bg-base-300 rounded-lg p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="font-semibold text-sm">Comparison Configuration</h3>
		{#if config}
			<button type="button" class="btn btn-ghost btn-xs text-error" onclick={clearConfig} {disabled}>
				Clear
			</button>
		{/if}
	</div>

	{#if !config}
		<button type="button" class="btn btn-ghost btn-sm w-full" onclick={initConfig} {disabled}>
			+ Configure Comparison
		</button>
		<p class="text-xs text-base-content/50 mt-2">
			Required for superlative and comparison template types.
		</p>
	{:else}
		<div class="space-y-3">
			<!-- Operator -->
			<div class="flex gap-2 items-center">
				<label class="w-24 text-sm text-base-content/80">Find</label>
				<div class="join flex-1">
					<button
						type="button"
						class={classNames('join-item btn btn-sm flex-1', {
							'btn-primary': config.operator === 'max',
							'btn-ghost': config.operator !== 'max'
						})}
						onclick={() => updateConfig({ operator: 'max' })}
						{disabled}
					>
						Highest (Max)
					</button>
					<button
						type="button"
						class={classNames('join-item btn btn-sm flex-1', {
							'btn-primary': config.operator === 'min',
							'btn-ghost': config.operator !== 'min'
						})}
						onclick={() => updateConfig({ operator: 'min' })}
						{disabled}
					>
						Lowest (Min)
					</button>
				</div>
			</div>

			<!-- Attribute -->
			<div class="flex gap-2 items-center">
				<label class="w-24 text-sm text-base-content/80">Attribute</label>
				<select
					class="select select-sm select-bordered flex-1"
					value={config.attribute}
					onchange={(e) => updateConfig({ attribute: e.currentTarget.value })}
					{disabled}
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

			<!-- Count (for comparison type) -->
			{#if showCount}
				<div class="flex gap-2 items-center">
					<label class="w-24 text-sm text-base-content/80">Compare</label>
					<div class="join">
						<button
							type="button"
							class={classNames('join-item btn btn-sm', {
								'btn-primary': config.count === 2,
								'btn-ghost': config.count !== 2
							})}
							onclick={() => updateConfig({ count: 2 })}
							{disabled}
						>
							2 Pokemon
						</button>
						<button
							type="button"
							class={classNames('join-item btn btn-sm', {
								'btn-primary': config.count === 4,
								'btn-ghost': config.count !== 4
							})}
							onclick={() => updateConfig({ count: 4 })}
							{disabled}
						>
							4 Pokemon
						</button>
					</div>
				</div>
			{/if}
		</div>

		<p class="text-xs text-base-content/50 mt-3">
			{#if config.operator === 'max'}
				Find the Pokemon with the <strong>highest</strong>
				{POKEMON_ATTRIBUTES[config.attribute]?.label ?? config.attribute}
			{:else}
				Find the Pokemon with the <strong>lowest</strong>
				{POKEMON_ATTRIBUTES[config.attribute]?.label ?? config.attribute}
			{/if}
			{#if showCount}
				among {config.count} randomly selected Pokemon
			{/if}
		</p>
	{/if}
</div>
