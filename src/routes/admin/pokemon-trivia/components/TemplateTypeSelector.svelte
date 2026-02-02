<script lang="ts">
	import classNames from 'classnames';
	import { TEMPLATE_TYPE_INFO, type TemplateType } from '$types/pokemon-trivia-template.type';

	interface Props {
		value: TemplateType;
		onchange: (value: TemplateType) => void;
		disabled?: boolean;
	}

	let { value, onchange, disabled = false }: Props = $props();

	const templateTypes = Object.entries(TEMPLATE_TYPE_INFO) as [
		TemplateType,
		(typeof TEMPLATE_TYPE_INFO)[TemplateType]
	][];
</script>

<div class="space-y-2">
	<label class="label">
		<span class="label-text font-semibold">Template Type</span>
	</label>
	<div class="grid grid-cols-3 gap-2">
		{#each templateTypes as [type, info]}
			<button
				type="button"
				class={classNames('rounded-lg border-2 p-3 text-left transition-all', 'hover:bg-base-300', {
					'border-primary bg-primary/10': value === type,
					'bg-base-200 border-transparent': value !== type,
					'cursor-not-allowed opacity-50': disabled,
					'cursor-pointer': !disabled
				})}
				onclick={() => !disabled && onchange(type)}
				{disabled}
			>
				<div class="mb-1 flex items-center gap-2">
					<span class="text-lg">{info.icon}</span>
					<span class="text-sm font-medium">{info.label}</span>
				</div>
				<p class="text-base-content/60 line-clamp-2 text-xs">{info.description}</p>
			</button>
		{/each}
	</div>
	{#if value && TEMPLATE_TYPE_INFO[value]}
		<div class="bg-base-300 mt-2 rounded-lg p-3">
			<div class="text-base-content/60 mb-1 text-xs">Example</div>
			<div class="text-sm font-medium">{TEMPLATE_TYPE_INFO[value].example}</div>
		</div>
	{/if}
</div>
