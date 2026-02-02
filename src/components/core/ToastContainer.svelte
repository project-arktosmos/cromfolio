<script lang="ts">
	import classNames from 'classnames';
	import { toastService, type Toast } from '$services/toast.service';
	import { ThemeColors } from '$types/core.type';

	let toasts = $state<Toast[]>([]);

	toastService.subscribe((value) => {
		toasts = value;
	});

	const alertClasses: Record<ThemeColors, string> = {
		[ThemeColors.Primary]: 'alert-primary',
		[ThemeColors.Secondary]: 'alert-secondary',
		[ThemeColors.Accent]: 'alert-accent',
		[ThemeColors.Success]: 'alert-success',
		[ThemeColors.Error]: 'alert-error',
		[ThemeColors.Info]: 'alert-info',
		[ThemeColors.Warning]: 'alert-warning',
		[ThemeColors.Neutral]: 'alert-neutral'
	};

	const icons: Record<ThemeColors, string> = {
		[ThemeColors.Success]: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		[ThemeColors.Error]: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
		[ThemeColors.Warning]:
			'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
		[ThemeColors.Info]: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		[ThemeColors.Primary]: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		[ThemeColors.Secondary]: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		[ThemeColors.Accent]: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		[ThemeColors.Neutral]: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};
</script>

<div class="fixed right-4 top-4 z-50 flex flex-col gap-2">
	{#each toasts as toast (toast.id)}
		<div class={classNames('alert shadow-lg', alertClasses[toast.type])}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 shrink-0"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d={icons[toast.type]}
				/>
			</svg>
			<span class="text-sm">{toast.message}</span>
			<button class="btn btn-ghost btn-xs" onclick={() => toastService.remove(toast.id)}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	{/each}
</div>
