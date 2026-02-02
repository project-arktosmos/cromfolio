<script lang="ts">
	import classNames from 'classnames';

	interface Props {
		timeRemaining: number;
		totalTime: number;
	}

	let { timeRemaining, totalTime }: Props = $props();

	let timerPercentage = $derived((timeRemaining / totalTime) * 100);

	function getTimerClass(): string {
		if (timeRemaining <= 3) return 'text-error';
		if (timeRemaining <= 5) return 'text-warning';
		return 'text-primary';
	}

	function getTimerProgressClass(): string {
		if (timeRemaining <= 3) return 'progress-error';
		if (timeRemaining <= 5) return 'progress-warning';
		return 'progress-primary';
	}
</script>

<div class="w-full max-w-3xl">
	<div class="flex items-center gap-3">
		<span class={classNames('text-2xl font-bold tabular-nums', getTimerClass())}
			>{timeRemaining}s</span
		>
		<progress
			class={classNames('progress flex-1', getTimerProgressClass())}
			value={timerPercentage}
			max="100"
		></progress>
	</div>
</div>
