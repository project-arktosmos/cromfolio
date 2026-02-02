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
				class={classNames(
					'p-3 rounded-lg text-left transition-all border-2',
					'hover:bg-base-300',
					{
						'border-primary bg-primary/10': value === type,
						'border-transparent bg-base-200': value !== type,
						'opacity-50 cursor-not-allowed': disabled,
						'cursor-pointer': !disabled
					}
				)}
				onclick={() => !disabled && onchange(type)}
				{disabled}
			>
				<div class="flex items-center gap-2 mb-1">
					<span class="text-lg">{info.icon}</span>
					<span class="font-medium text-sm">{info.label}</span>
				</div>
				<p class="text-xs text-base-content/60 line-clamp-2">{info.description}</p>
			</button>
		{/each}
	</div>
	{#if value && TEMPLATE_TYPE_INFO[value]}
		<div class="bg-base-300 rounded-lg p-3 mt-2">
			<div class="text-xs text-base-content/60 mb-1">Example</div>
			<div class="text-sm font-medium">{TEMPLATE_TYPE_INFO[value].example}</div>
		</div>
	{/if}
</div>
