<script lang="ts">
	import classNames from 'classnames';
	import type { UserPlacedIcon } from '$types/user-placed-icon.type';

	interface Props {
		placedIcons: UserPlacedIcon[];
		editable?: boolean;
		classes?: string;
		oniconclick?: (placedIcon: UserPlacedIcon) => void;
		oniconremove?: (placedIcon: UserPlacedIcon) => void;
	}

	let {
		placedIcons,
		editable = false,
		classes = '',
		oniconclick,
		oniconremove
	}: Props = $props();

	function handleRemoveClick(e: MouseEvent, placedIcon: UserPlacedIcon) {
		e.stopPropagation();
		oniconremove?.(placedIcon);
	}

	let computedClasses = $derived(classNames('absolute inset-0 overflow-hidden', classes));
</script>

<div class={computedClasses}>
	{#each placedIcons as placedIcon (placedIcon.id)}
		<div
			class={classNames('absolute w-12 h-12 group', {
				'pointer-events-auto cursor-pointer hover:ring-2 hover:ring-primary rounded': editable
			})}
			style="
				left: {placedIcon.positionX}%;
				top: {placedIcon.positionY}%;
				transform: translate(-50%, -50%) scale({placedIcon.scale}) rotate({placedIcon.rotation}deg);
			"
			onclick={() => editable && oniconclick?.(placedIcon)}
			role={editable ? 'button' : 'img'}
			tabindex={editable ? 0 : -1}
		>
			<div
				class="w-full h-full drop-shadow-md"
				style="
					background-color: {placedIcon.color};
					-webkit-mask: url('{placedIcon.iconPath}') center/contain no-repeat;
					mask: url('{placedIcon.iconPath}') center/contain no-repeat;
				"
			></div>
			{#if editable}
				<button
					class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-error-content rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
					onclick={(e) => handleRemoveClick(e, placedIcon)}
					title="Remove icon"
				>
					×
				</button>
			{/if}
		</div>
	{/each}
</div>
