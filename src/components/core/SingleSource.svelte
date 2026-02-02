<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import type { Source } from '$types/source.type';

	// Props
	interface Props {
		source: Source;
		cardCountsByType?: Record<string, number>;
		width?: number;
		height?: number;
		interactive?: boolean;
		autoRotate?: boolean;
		classes?: string;
		onclick?: () => void;
	}

	let {
		source,
		cardCountsByType = {},
		width = 400,
		height = 400,
		interactive = true,
		autoRotate = true,
		classes = '',
		onclick
	}: Props = $props();

	// Three.js objects
	let container: HTMLDivElement;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let bookGroup: THREE.Group | null = null;
	let frontCoverPivot: THREE.Group | null = null;
	let backCoverPivot: THREE.Group | null = null;
	let animationId: number | null = null;
	let loadedTextures: THREE.Texture[] = [];

	// Interaction state
	let isDragging = $state(false);
	let previousMouseX = 0;
	let previousMouseY = 0;
	let rotationY = $state(-0.3);
	let rotationX = $state(0.1);

	// Book open/close animation state
	let isOpen = $state(false);
	let isAnimating = $state(false);
	let openProgress = 0;
	const OPEN_ANGLE = Math.PI * 0.85; // How far the covers open (slightly less than 180 degrees)
	const ANIMATION_SPEED = 0.04;

	// Book dimensions (proportions of a standard hardcover book)
	const BOOK_WIDTH = 2.5;
	const BOOK_HEIGHT = 3.5;
	const BOOK_DEPTH = 0.25;
	const COVER_THICKNESS = 0.03;

	function createPageTexture(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Cream colored pages
		ctx.fillStyle = '#f5f5dc';
		ctx.fillRect(0, 0, 256, 512);

		// Draw horizontal lines to simulate page edges
		ctx.strokeStyle = '#e0e0c0';
		ctx.lineWidth = 1;
		for (let i = 0; i < 512; i += 4) {
			ctx.beginPath();
			ctx.moveTo(0, i);
			ctx.lineTo(256, i);
			ctx.stroke();
		}

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function createSpineTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 128;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Dark spine color
		ctx.fillStyle = '#1a202c';
		ctx.fillRect(0, 0, 128, 512);

		// Add title text rotated
		ctx.save();
		ctx.translate(64, 256);
		ctx.rotate(-Math.PI / 2);
		ctx.fillStyle = '#c0a060';
		ctx.font = 'bold 36px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Truncate title if too long
		const maxLength = 25;
		const displayTitle = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
		ctx.fillText(displayTitle, 0, 0);
		ctx.restore();

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function getProxiedUrl(url: string): string {
		// Check if the URL is external (starts with http:// or https://)
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return `/api/image-proxy?url=${encodeURIComponent(url)}`;
		}
		// Local URLs don't need proxying
		return url;
	}

	function loadCoverTexture(url: string): Promise<THREE.Texture> {
		return new Promise((resolve, reject) => {
			const textureLoader = new THREE.TextureLoader();
			const proxiedUrl = getProxiedUrl(url);

			textureLoader.load(
				proxiedUrl,
				(texture) => {
					texture.colorSpace = THREE.SRGBColorSpace;
					texture.minFilter = THREE.LinearFilter;
					texture.magFilter = THREE.LinearFilter;
					loadedTextures.push(texture);
					resolve(texture);
				},
				undefined,
				(error) => {
					console.warn('Failed to load cover texture:', error);
					reject(error);
				}
			);
		});
	}

	function createFallbackCoverTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Gradient background
		const gradient = ctx.createLinearGradient(0, 0, 0, 512);
		gradient.addColorStop(0, '#4a5568');
		gradient.addColorStop(1, '#2d3748');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 512);

		// Border
		ctx.strokeStyle = '#718096';
		ctx.lineWidth = 8;
		ctx.strokeRect(20, 20, 472, 472);

		// Title
		ctx.fillStyle = '#e2e8f0';
		ctx.font = 'bold 36px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Word wrap title
		const words = title.split(' ');
		const lines: string[] = [];
		let currentLine = '';
		const maxWidth = 400;

		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			const metrics = ctx.measureText(testLine);
			if (metrics.width > maxWidth && currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) lines.push(currentLine);

		const lineHeight = 44;
		const startY = 256 - ((lines.length - 1) * lineHeight) / 2;
		lines.forEach((line, i) => {
			ctx.fillText(line, 256, startY + i * lineHeight);
		});

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function formatSourceType(sourceType: string): string {
		const typeLabels: Record<string, string> = {
			movie: 'Movie',
			tv: 'TV Series',
			videogame: 'Video Game',
			anime: 'Anime',
			sports_league: 'Sports',
			animal: 'Animal',
			musician: 'Musician',
			author: 'Author'
		};
		return typeLabels[sourceType] || sourceType;
	}

	function formatCardType(cardType: string): string {
		const typeLabels: Record<string, string> = {
			poster: 'Posters',
			backdrop: 'Backdrops',
			logo: 'Logos',
			cast: 'Cast',
			characterart: 'Character Art',
			cover: 'Covers',
			screenshot: 'Screenshots',
			artwork: 'Artwork',
			hero: 'Heroes',
			icon: 'Icons',
			grid: 'Grids',
			character: 'Characters',
			main_character: 'Main Characters',
			player: 'Players',
			team_badge: 'Team Badges',
			photo: 'Photos',
			other: 'Other'
		};
		return typeLabels[cardType] || cardType;
	}

	function createBackCoverTexture(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Dark background
		ctx.fillStyle = '#1a202c';
		ctx.fillRect(0, 0, 512, 512);

		// Inner border
		ctx.strokeStyle = '#4a5568';
		ctx.lineWidth = 4;
		ctx.strokeRect(24, 24, 464, 464);

		// Source type badge at top
		const sourceTypeLabel = formatSourceType(source.sourceType);
		ctx.fillStyle = '#c0a060';
		ctx.font = 'bold 28px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText(sourceTypeLabel.toUpperCase(), 256, 50);

		// Decorative line under source type
		ctx.strokeStyle = '#c0a060';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(100, 90);
		ctx.lineTo(412, 90);
		ctx.stroke();

		// Card counts section
		const entries = Object.entries(cardCountsByType).filter(([, count]) => count > 0);
		const totalCards = entries.reduce((sum, [, count]) => sum + count, 0);

		if (entries.length > 0) {
			// "Cards" header
			ctx.fillStyle = '#e2e8f0';
			ctx.font = 'bold 22px Arial';
			ctx.textAlign = 'center';
			ctx.fillText('CARDS', 256, 120);

			// Total count
			ctx.fillStyle = '#c0a060';
			ctx.font = 'bold 48px Arial';
			ctx.fillText(String(totalCards), 256, 155);

			// Card type breakdown
			ctx.font = '18px Arial';
			ctx.textAlign = 'left';
			ctx.fillStyle = '#a0aec0';

			const startY = 230;
			const lineHeight = 28;
			const maxLines = 8;
			const displayEntries = entries.slice(0, maxLines);

			displayEntries.forEach(([cardType, count], index) => {
				const y = startY + index * lineHeight;
				const label = formatCardType(cardType);

				// Card type label
				ctx.textAlign = 'left';
				ctx.fillStyle = '#a0aec0';
				ctx.fillText(label, 60, y);

				// Count
				ctx.textAlign = 'right';
				ctx.fillStyle = '#e2e8f0';
				ctx.fillText(String(count), 452, y);
			});

			// Show "and more..." if there are more types
			if (entries.length > maxLines) {
				const y = startY + maxLines * lineHeight;
				ctx.textAlign = 'center';
				ctx.fillStyle = '#718096';
				ctx.font = 'italic 16px Arial';
				ctx.fillText(`+${entries.length - maxLines} more types...`, 256, y);
			}
		} else {
			// No cards message
			ctx.fillStyle = '#718096';
			ctx.font = 'italic 20px Arial';
			ctx.textAlign = 'center';
			ctx.fillText('No cards yet', 256, 256);
		}

		// Bottom decorative element
		ctx.strokeStyle = '#4a5568';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(150, 460);
		ctx.lineTo(362, 460);
		ctx.stroke();

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function createInnerPageTexture(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Cream colored page
		ctx.fillStyle = '#f8f5e6';
		ctx.fillRect(0, 0, 512, 512);

		// Add subtle lines like a notebook
		ctx.strokeStyle = '#e8e5d6';
		ctx.lineWidth = 1;
		for (let i = 40; i < 512; i += 24) {
			ctx.beginPath();
			ctx.moveTo(30, i);
			ctx.lineTo(482, i);
			ctx.stroke();
		}

		// Add a margin line
		ctx.strokeStyle = '#f0c0c0';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(50, 20);
		ctx.lineTo(50, 492);
		ctx.stroke();

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function createCoverInsideTexture(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Marbled paper effect for inside cover
		const gradient = ctx.createLinearGradient(0, 0, 512, 512);
		gradient.addColorStop(0, '#2d3748');
		gradient.addColorStop(0.5, '#1a202c');
		gradient.addColorStop(1, '#2d3748');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 512);

		// Add some decorative pattern
		ctx.strokeStyle = '#4a5568';
		ctx.lineWidth = 1;
		for (let i = 0; i < 512; i += 20) {
			ctx.beginPath();
			ctx.moveTo(i, 0);
			ctx.lineTo(i + 100, 512);
			ctx.stroke();
		}

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	async function initScene() {
		if (!container) return;

		// Scene
		scene = new THREE.Scene();
		scene.background = null;

		// Camera
		camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
		camera.position.set(0, 0, 6);
		camera.lookAt(0, 0, 0);

		// Renderer
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			logarithmicDepthBuffer: true // Helps prevent z-fighting
		});
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		container.appendChild(renderer.domElement);

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		scene.add(ambientLight);

		const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
		keyLight.position.set(3, 4, 5);
		scene.add(keyLight);

		const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
		fillLight.position.set(-3, 2, 3);
		scene.add(fillLight);

		// Create book
		await createBook();

		// Start animation loop
		animate();
	}

	async function createBook() {
		if (!scene) return;

		// Load or create cover texture
		let coverTexture: THREE.Texture;
		if (source.coverImage) {
			try {
				coverTexture = await loadCoverTexture(source.coverImage);
			} catch {
				coverTexture = createFallbackCoverTexture(source.title);
			}
		} else {
			coverTexture = createFallbackCoverTexture(source.title);
		}

		// Create textures
		const pageTexture = createPageTexture();
		const spineTexture = createSpineTexture(source.title);
		const backCoverTexture = createBackCoverTexture();
		const innerPageTexture = createInnerPageTexture();
		const coverInsideTexture = createCoverInsideTexture();

		// Create book group to hold all parts
		bookGroup = new THREE.Group();

		// Page block dimensions (slightly smaller than covers)
		const pageBlockWidth = BOOK_WIDTH - 0.05;
		const pageBlockDepth = BOOK_DEPTH - COVER_THICKNESS * 2;

		// Create page block (the inner pages)
		const pageBlockGeometry = new THREE.BoxGeometry(
			pageBlockWidth,
			BOOK_HEIGHT - 0.02,
			pageBlockDepth
		);
		const pageBlockMaterials = [
			new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.9 }), // +X: right edge
			new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.9 }), // -X: left edge (spine side)
			new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.9 }), // +Y: top
			new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.9 }), // -Y: bottom
			new THREE.MeshStandardMaterial({ map: innerPageTexture, roughness: 0.8 }), // +Z: front page
			new THREE.MeshStandardMaterial({ map: innerPageTexture, roughness: 0.8 }) // -Z: back page
		];
		const pageBlock = new THREE.Mesh(pageBlockGeometry, pageBlockMaterials);
		pageBlock.position.x = 0.025; // Slight offset from spine
		bookGroup.add(pageBlock);

		// Create spine
		const spineGeometry = new THREE.BoxGeometry(COVER_THICKNESS, BOOK_HEIGHT, BOOK_DEPTH);
		const spineMaterial = new THREE.MeshStandardMaterial({ map: spineTexture, roughness: 0.7 });
		const spine = new THREE.Mesh(spineGeometry, spineMaterial);
		spine.position.x = -BOOK_WIDTH / 2 - COVER_THICKNESS / 2;
		bookGroup.add(spine);

		// Create front cover with pivot at spine edge
		frontCoverPivot = new THREE.Group();
		frontCoverPivot.position.x = -BOOK_WIDTH / 2;
		frontCoverPivot.position.z = BOOK_DEPTH / 2;

		const frontCoverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS);
		const frontCoverMaterials = [
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // +X: right edge
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // -X: left edge
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // +Y: top
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // -Y: bottom
			new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.5 }), // +Z: front cover (outside)
			new THREE.MeshStandardMaterial({ map: coverInsideTexture, roughness: 0.7 }) // -Z: inside cover
		];
		const frontCover = new THREE.Mesh(frontCoverGeometry, frontCoverMaterials);
		frontCover.position.x = BOOK_WIDTH / 2; // Offset from pivot
		frontCoverPivot.add(frontCover);
		bookGroup.add(frontCoverPivot);

		// Create back cover with pivot at spine edge
		backCoverPivot = new THREE.Group();
		backCoverPivot.position.x = -BOOK_WIDTH / 2;
		backCoverPivot.position.z = -BOOK_DEPTH / 2;

		const backCoverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS);
		const backCoverMaterials = [
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // +X: right edge
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // -X: left edge
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // +Y: top
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // -Y: bottom
			new THREE.MeshStandardMaterial({ map: coverInsideTexture, roughness: 0.7 }), // +Z: inside cover
			new THREE.MeshStandardMaterial({ map: backCoverTexture, roughness: 0.7 }) // -Z: back cover (outside)
		];
		const backCover = new THREE.Mesh(backCoverGeometry, backCoverMaterials);
		backCover.position.x = BOOK_WIDTH / 2; // Offset from pivot
		backCoverPivot.add(backCover);
		bookGroup.add(backCoverPivot);

		// Set initial rotation
		bookGroup.rotation.y = rotationY;
		bookGroup.rotation.x = rotationX;

		scene.add(bookGroup);
	}

	export function toggleOpen() {
		if (isAnimating) return;
		isOpen = !isOpen;
		isAnimating = true;
	}

	function animate() {
		if (!renderer || !scene || !camera) return;

		animationId = requestAnimationFrame(animate);

		// Handle open/close animation
		if (isAnimating) {
			const targetProgress = isOpen ? 1 : 0;
			const diff = targetProgress - openProgress;

			if (Math.abs(diff) < 0.01) {
				openProgress = targetProgress;
				isAnimating = false;
			} else {
				openProgress += diff * ANIMATION_SPEED * 2;
			}

			// Apply rotation to covers
			if (frontCoverPivot) {
				frontCoverPivot.rotation.y = -openProgress * OPEN_ANGLE;
			}
			if (backCoverPivot) {
				backCoverPivot.rotation.y = openProgress * OPEN_ANGLE;
			}
		}

		if (bookGroup) {
			if (autoRotate && !isDragging && !isAnimating && !isOpen) {
				rotationY += 0.005;
			}
			bookGroup.rotation.y = rotationY;
			bookGroup.rotation.x = rotationX;
		}

		renderer.render(scene, camera);
	}

	function handleMouseDown(e: MouseEvent) {
		if (!interactive) return;
		isDragging = true;
		previousMouseX = e.clientX;
		previousMouseY = e.clientY;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !interactive) return;

		const deltaX = e.clientX - previousMouseX;
		const deltaY = e.clientY - previousMouseY;

		rotationY += deltaX * 0.01;
		rotationX += deltaY * 0.01;
		rotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, rotationX));

		previousMouseX = e.clientX;
		previousMouseY = e.clientY;
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleMouseLeave() {
		isDragging = false;
	}

	function handleClick() {
		if (onclick && !isDragging) {
			onclick();
		}
	}

	onMount(() => {
		initScene();
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);

		// Cleanup Three.js resources
		loadedTextures.forEach((t) => t.dispose());

		if (renderer) {
			renderer.dispose();
		}
		if (scene) {
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
					if (Array.isArray(object.material)) {
						object.material.forEach((m) => m.dispose());
					} else {
						object.material.dispose();
					}
				}
			});
		}
	});
</script>

<div class={classNames('relative', classes)}>
	<div
		class={classNames('overflow-hidden rounded-lg', {
			'cursor-grab': interactive && !isDragging,
			'cursor-grabbing': interactive && isDragging
		})}
		style="width: {width}px; height: {height}px;"
		bind:this={container}
		onmousedown={handleMouseDown}
		onmouseleave={handleMouseLeave}
		onclick={handleClick}
		role={interactive ? 'button' : undefined}
		tabindex={interactive ? 0 : undefined}
	></div>
	<button
		class="btn btn-circle btn-sm btn-primary absolute bottom-2 right-2 shadow-lg"
		onclick={(e) => {
			e.stopPropagation();
			toggleOpen();
		}}
		disabled={isAnimating}
		title={isOpen ? 'Close book' : 'Open book'}
	>
		{#if isOpen}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
				/>
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
				/>
			</svg>
		{/if}
	</button>
</div>
