<script lang="ts">
	interface Props {
		totalUniqueStickers: number;
		totalCopies: number;
		placedCount: number;
		mixableCount: number;
	}

	let { totalUniqueStickers, totalCopies, placedCount, mixableCount }: Props = $props();

	let placedPercent = $derived(
		totalUniqueStickers > 0 ? Math.round((placedCount / totalUniqueStickers) * 100) : 0
	);
</script>

<div class="stats stats-vertical sm:stats-horizontal bg-base-200 w-full shrink-0 shadow">
	<div class="stat">
		<div class="stat-title">Unique Stickers</div>
		<div class="stat-value text-primary">{totalUniqueStickers}</div>
		<div class="stat-desc">Different stickers owned</div>
	</div>
	<div class="stat">
		<div class="stat-title">Total Copies</div>
		<div class="stat-value text-secondary">{totalCopies}</div>
		<div class="stat-desc">Including duplicates</div>
	</div>
	<div class="stat">
		<div class="stat-title">Placed in Albums</div>
		<div class="stat-value text-success">{placedCount}</div>
		<div class="stat-desc">{placedPercent}% stuck in albums</div>
	</div>
	<div class="stat">
		<div class="stat-title">Can Mix</div>
		<div class="stat-value text-accent">{mixableCount}</div>
		<div class="stat-desc">Upgrade duplicates</div>
	</div>
</div>
