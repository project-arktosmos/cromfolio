<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { Collection } from '$types/collection.type';
	import type { Rarity } from '$types/rarity.type';
	import type { CollectionDetailedStats } from '$types/game-state.type';

	interface Props {
		collection: Collection;
		stats: CollectionDetailedStats;
		rarities: Rarity[];
		isSelected: boolean;
		hasStickersInCollection: boolean;
	}

	let { collection, stats, rarities, isSelected, hasStickersInCollection }: Props = $props();

	const dispatch = createEventDispatcher<{
		select: Collection;
		openPack: { collection: Collection; event: MouseEvent };
	}>();

	let isComplete = $derived(stats.total > 0 && stats.owned >= stats.total);
	let completionPercent = $derived(
		stats.maxCompletionScore > 0
			? Math.round((stats.completionScore / stats.maxCompletionScore) * 100)
			: 0
	);
</script>

<div
	class={classNames('cursor-pointer rounded-lg border p-3 transition-all', {
		'bg-primary/10 border-primary': isSelected,
		'bg-base-200 hover:bg-base-300 border-transparent': !isSelected
	})}
	onclick={() => dispatch('select', collection)}
	onkeydown={(e) => e.key === 'Enter' && dispatch('select', collection)}
	role="button"
	tabindex="0"
>
	<div class="flex items-center gap-3">
		{#if collection.coverImage}
			<img
				src={collection.coverImage}
				alt={collection.title}
				class="h-16 w-12 rounded object-cover"
			/>
		{:else}
			<div
				class="bg-base-300 text-base-content/30 flex h-16 w-12 items-center justify-center rounded"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					/>
				</svg>
			</div>
		{/if}
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="truncate font-medium">{collection.title}</span>
				{#if isComplete}
					<span class="badge badge-success badge-sm">Complete</span>
				{/if}
			</div>
			<!-- Rarity breakdown display -->
			{#if stats.rarityBreakdown.size > 0}
				<div class="mt-1 flex flex-wrap gap-1">
					{#each rarities.toSorted((a, b) => b.sortOrder - a.sortOrder) as rarity (rarity.id)}
						{@const count = stats.rarityBreakdown.get(String(rarity.id)) ?? 0}
						{#if count > 0}
							<span
								class="rounded px-1.5 py-0.5 text-xs font-medium"
								style="background: linear-gradient(135deg, {rarity.colorFrom}, {rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
								title="{rarity.name}: {count}"
							>
								{count}
							</span>
						{/if}
					{/each}
				</div>
			{:else if stats.owned === 0}
				<div class="text-base-content/40 mt-1 text-sm">No stickers yet</div>
			{/if}
			<!-- Completion progress bar -->
			{#if stats.maxCompletionScore > 0}
				<div class="mt-1 flex items-center gap-2">
					<progress
						class={classNames('progress h-2 flex-1', {
							'progress-success': completionPercent === 100,
							'progress-warning': completionPercent >= 50 && completionPercent < 100,
							'progress-primary': completionPercent < 50
						})}
						value={stats.completionScore}
						max={stats.maxCompletionScore}
					></progress>
					<span class="text-base-content/60 w-10 text-right font-mono text-xs"
						>{completionPercent}%</span
					>
				</div>
			{/if}
			{#if stats.total > 0}
				<button
					class="btn btn-primary btn-xs mt-2 w-full"
					onclick={(e) => {
						e.stopPropagation();
						dispatch('openPack', { collection, event: e });
					}}
					disabled={!hasStickersInCollection}
				>
					Open Booster Pack
				</button>
			{/if}
		</div>
	</div>
</div>
