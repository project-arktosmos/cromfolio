<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';

	interface Props {
		currentSpread: number;
		totalSpreads: number;
		isFlipping: boolean;
		showWinnerIcon?: boolean;
	}

	let { currentSpread, totalSpreads, isFlipping, showWinnerIcon = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		prev: void;
		next: void;
	}>();

	let canGoBack = $derived(currentSpread > 0 && !isFlipping);
	let canGoForward = $derived(currentSpread < totalSpreads - 1 && !isFlipping);
</script>

<div class="mt-4 flex items-center justify-between">
	<button class="btn btn-circle btn-outline" onclick={() => dispatch('prev')} disabled={!canGoBack}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
		</svg>
	</button>

	<div class="flex items-center gap-2">
		<span class="text-base-content/60 text-sm">
			{#if currentSpread === 0}
				Cover
			{:else}
				Page {currentSpread} of {totalSpreads - 1}
			{/if}
		</span>
		{#if showWinnerIcon}
			<span class="badge badge-warning badge-sm gap-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-3 w-3"
					fill="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
					/>
				</svg>
				Winners
			</span>
		{/if}
	</div>

	<button
		class="btn btn-circle btn-outline"
		onclick={() => dispatch('next')}
		disabled={!canGoForward}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
	</button>
</div>
