<script lang="ts" generics="T extends { id: string | number; positionX: number; positionY: number; scale: number; rotation: number }">
	import classNames from 'classnames';
	import type { Snippet } from 'svelte';

	interface Props {
		items: T[];
		editable?: boolean;
		classes?: string;
		onitemclick?: (item: T) => void;
		onitemremove?: (item: T) => void;
		children: Snippet<[T]>;
	}

	let {
		items,
		editable = false,
		classes = '',
		onitemclick,
		onitemremove,
		children
	}: Props = $props();

	function handleRemoveClick(e: MouseEvent, item: T) {
		e.stopPropagation();
		onitemremove?.(item);
	}

	let computedClasses = $derived(
		classNames('absolute inset-0 z-[999] overflow-hidden pointer-events-none', classes)
	);
</script>

<div class={computedClasses}>
	{#each items as item (item.id)}
		<div
			class={classNames('group absolute h-12 w-12', {
				'hover:ring-primary pointer-events-auto cursor-pointer rounded hover:ring-2': editable
			})}
			style="
				left: {item.positionX}%;
				top: {item.positionY}%;
				transform: translate(-50%, -50%) scale({item.scale}) rotate({item.rotation}deg);
			"
			onclick={() => editable && onitemclick?.(item)}
			role={editable ? 'button' : 'img'}
			tabindex={editable ? 0 : -1}
		>
			{@render children(item)}
			{#if editable}
				<button
					class="bg-error text-error-content absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100"
					onclick={(e) => handleRemoveClick(e, item)}
					title="Remove item"
				>
					×
				</button>
			{/if}
		</div>
	{/each}
</div>
