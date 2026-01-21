<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { imageService } from '$services/image/image.service';

	interface Props {
		src: string;
		alt: string;
		class?: string;
		aspectRatio?: string;
		skeletonClass?: string;
		/** If true, bypass the Tauri image cache (default: false) */
		noCache?: boolean;
		/** If true, use lazy loading with Intersection Observer (default: true) */
		lazy?: boolean;
	}

	let {
		src,
		alt,
		class: className = '',
		aspectRatio = '1/1',
		skeletonClass = '',
		noCache = false,
		lazy = true
	}: Props = $props();

	let containerRef: HTMLDivElement | null = $state(null);
	let isLoading = $state(true);
	let hasError = $state(false);
	let resolvedSrc = $state('');
	let isVisible = $state(!lazy); // If not lazy, consider immediately visible
	let observer: IntersectionObserver | null = null;

	// Resolve the image URL through Tauri cache
	async function resolveImage() {
		if (!src) {
			resolvedSrc = '';
			return;
		}

		if (noCache || !src.startsWith('http')) {
			resolvedSrc = src;
			return;
		}

		try {
			const resolved = await imageService.getImageUrl(src);
			resolvedSrc = resolved;
		} catch (err) {
			console.warn('Failed to resolve image URL:', err);
			resolvedSrc = src; // Fallback to original URL
		}
	}

	// Set up Intersection Observer for lazy loading
	onMount(() => {
		if (!lazy) {
			// Not lazy - resolve immediately
			resolveImage();
			return;
		}

		// Create Intersection Observer
		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						isVisible = true;
						// Once visible, we can disconnect - no need to observe anymore
						observer?.disconnect();
						break;
					}
				}
			},
			{
				rootMargin: '100px', // Start loading 100px before entering viewport
				threshold: 0
			}
		);

		if (containerRef) {
			observer.observe(containerRef);
		}
	});

	onDestroy(() => {
		observer?.disconnect();
	});

	// Resolve image when it becomes visible or src changes
	$effect(() => {
		if (isVisible && src) {
			// Reset state for new src
			isLoading = true;
			hasError = false;
			resolveImage();
		}
	});

	function handleLoad() {
		isLoading = false;
	}

	function handleError() {
		console.error('Image failed to load:', { src, resolvedSrc });
		isLoading = false;
		hasError = true;
	}

	const containerClasses = $derived(classNames('relative overflow-hidden', className));

	const skeletonClasses = $derived(classNames('absolute inset-0 skeleton bg-base-300', skeletonClass));
</script>

<div bind:this={containerRef} class={containerClasses} style="aspect-ratio: {aspectRatio};">
	{#if isLoading || !isVisible}
		<div class={skeletonClasses}></div>
	{/if}
	{#if hasError}
		<div class="absolute inset-0 flex items-center justify-center bg-base-300 text-base-content/40">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-8 w-8"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
		</div>
	{:else if isVisible && resolvedSrc}
		<img
			src={resolvedSrc}
			{alt}
			loading="lazy"
			class={classNames('h-full w-full object-cover', { 'opacity-0': isLoading })}
			onload={handleLoad}
			onerror={handleError}
		/>
	{/if}
</div>
