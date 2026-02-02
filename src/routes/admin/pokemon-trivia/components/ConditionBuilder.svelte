<script lang="ts">
	import classNames from 'classnames';
	import {
		CONDITION_OPERATOR_INFO,
		type TemplateCondition,
		type ConditionOperator
	} from '$types/pokemon-trivia-template.type';
	import { groupAttributesByCategory } from '$utils/pokemon-trivia';

	interface Props {
		conditions: TemplateCondition[];
		conditionLogic: 'and' | 'or';
		onConditionsChange: (conditions: TemplateCondition[]) => void;
		onLogicChange: (logic: 'and' | 'or') => void;
		disabled?: boolean;
	}

	let {
		conditions,
		conditionLogic,
		onConditionsChange,
		onLogicChange,
		disabled = false
	}: Props = $props();

	const operators = Object.entries(CONDITION_OPERATOR_INFO) as [
		ConditionOperator,
		(typeof CONDITION_OPERATOR_INFO)[ConditionOperator]
	][];

	const attributesByCategory = groupAttributesByCategory();

	function addCondition() {
		const newCondition: TemplateCondition = {
			attribute: 'type',
			operator: 'eq',
			value: ''
		};
		onConditionsChange([...conditions, newCondition]);
	}

	function removeCondition(index: number) {
		onConditionsChange(conditions.filter((_, i) => i !== index));
	}

	function updateCondition(index: number, updates: Partial<TemplateCondition>) {
		const updated = conditions.map((c, i) => (i === index ? { ...c, ...updates } : c));
		onConditionsChange(updated);
	}

	function needsValue(op: ConditionOperator): boolean {
		return CONDITION_OPERATOR_INFO[op]?.requiresValue ?? false;
	}

	function needsValues(op: ConditionOperator): boolean {
		return CONDITION_OPERATOR_INFO[op]?.requiresValues ?? false;
	}
</script>

<div class="bg-base-300 rounded-lg p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="font-semibold text-sm">Conditions</h3>
		<div class="join">
			<button
				type="button"
				class={classNames('join-item btn btn-xs', {
					'btn-primary': conditionLogic === 'and',
					'btn-ghost': conditionLogic !== 'and'
				})}
				onclick={() => onLogicChange('and')}
				{disabled}
			>
				AND
			</button>
			<button
				type="button"
				class={classNames('join-item btn btn-xs', {
					'btn-primary': conditionLogic === 'or',
					'btn-ghost': conditionLogic !== 'or'
				})}
				onclick={() => onLogicChange('or')}
				{disabled}
			>
				OR
			</button>
		</div>
	</div>

	<div class="space-y-2">
		{#each conditions as condition, index (index)}
			<div class="flex gap-2 items-start bg-base-100 p-2 rounded">
				<!-- Attribute selector -->
				<select
					class="select select-sm select-bordered flex-1 min-w-0"
					value={condition.attribute}
					onchange={(e) => updateCondition(index, { attribute: e.currentTarget.value })}
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

				<!-- Operator selector -->
				<select
					class="select select-sm select-bordered w-36"
					value={condition.operator}
					onchange={(e) =>
						updateCondition(index, { operator: e.currentTarget.value as ConditionOperator })}
					{disabled}
				>
					{#each operators as [op, info]}
						<option value={op}>{info.label}</option>
					{/each}
				</select>

				<!-- Value input (conditional) -->
				{#if needsValue(condition.operator)}
					<input
						type="text"
						class="input input-sm input-bordered flex-1 min-w-0"
						placeholder="Value"
						value={condition.value ?? ''}
						oninput={(e) => updateCondition(index, { value: e.currentTarget.value })}
						{disabled}
					/>
				{:else if needsValues(condition.operator)}
					{#if condition.operator === 'between'}
						<input
							type="number"
							class="input input-sm input-bordered w-20"
							placeholder="Min"
							value={condition.values?.[0] ?? ''}
							oninput={(e) =>
								updateCondition(index, {
									values: [e.currentTarget.value, condition.values?.[1] ?? '']
								})}
							{disabled}
						/>
						<span class="self-center">-</span>
						<input
							type="number"
							class="input input-sm input-bordered w-20"
							placeholder="Max"
							value={condition.values?.[1] ?? ''}
							oninput={(e) =>
								updateCondition(index, {
									values: [condition.values?.[0] ?? '', e.currentTarget.value]
								})}
							{disabled}
						/>
					{:else}
						<input
							type="text"
							class="input input-sm input-bordered flex-1 min-w-0"
							placeholder="value1, value2, ..."
							value={condition.values?.join(', ') ?? ''}
							oninput={(e) =>
								updateCondition(index, {
									values: e.currentTarget.value.split(',').map((v) => v.trim())
								})}
							{disabled}
						/>
					{/if}
				{/if}

				<!-- Remove button -->
				<button
					type="button"
					class="btn btn-ghost btn-sm text-error"
					onclick={() => removeCondition(index)}
					{disabled}
				>
					✕
				</button>
			</div>
		{/each}
	</div>

	<button type="button" class="btn btn-ghost btn-sm mt-2" onclick={addCondition} {disabled}>
		+ Add Condition
	</button>

	{#if conditions.length === 0}
		<p class="text-xs text-base-content/50 mt-2">
			No conditions added. Add conditions to filter which Pokemon match this template.
		</p>
	{/if}
</div>
