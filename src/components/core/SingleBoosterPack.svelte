<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import type { Source } from '$types/source.type';

	// Props
	interface Props {
		source: Source;
		cardCount?: number;
		wrapperColor?: string;
		width?: number;
		height?: number;
		interactive?: boolean;
		autoRotate?: boolean;
		classes?: string;
		onclick?: () => void;
	}

	let {
		source,
		cardCount = 10,
		wrapperColor = '#c0c0c0',
		width = 300,
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
	let packGroup: THREE.Group | null = null;
	let animationId: number | null = null;
	let loadedTextures: THREE.Texture[] = [];

	// Interaction state
	let isDragging = $state(false);
	let previousMouseX = 0;
	let previousMouseY = 0;
	let rotationY = $state(0);
	let rotationX = $state(0);

	// Hover animation state
	let hoverProgress = 0;
	let isHovering = $state(false);

	function getProxiedUrl(url: string): string {
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return `/api/image-proxy?url=${encodeURIComponent(url)}`;
		}
		return url;
	}

	function loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = (error) => reject(error);
			img.src = getProxiedUrl(url);
		});
	}

	function createImageTexture(image: HTMLImageElement): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Transparent background
		ctx.clearRect(0, 0, 512, 512);

		// Scale image to fill the canvas while maintaining aspect ratio
		const imgAspect = image.width / image.height;
		const canvasAspect = 1; // square canvas

		let drawWidth: number;
		let drawHeight: number;

		if (imgAspect > canvasAspect) {
			// Image is wider - fit to height
			drawHeight = 512;
			drawWidth = 512 * imgAspect;
		} else {
			// Image is taller - fit to width
			drawWidth = 512;
			drawHeight = 512 / imgAspect;
		}

		const drawX = (512 - drawWidth) / 2;
		const drawY = (512 - drawHeight) / 2;

		// Draw the image centered and covering
		ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		loadedTextures.push(texture);
		return texture;
	}

	function formatSourceType(sourceType: string): string {
		const typeLabels: Record<string, string> = {
			movie: 'MOVIE',
			tv: 'TV SHOW',
			videogame: 'VIDEO GAME',
			anime: 'ANIME',
			sports_league: 'SPORTS',
			animal: 'ANIMAL',
			musician: 'MUSIC',
			author: 'BOOKS'
		};
		return typeLabels[sourceType] || sourceType.toUpperCase();
	}

	function createTypeTexture(sourceType: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 96;
		const ctx = canvas.getContext('2d')!;

		// Transparent background
		ctx.clearRect(0, 0, 512, 96);

		// Draw type label text
		ctx.fillStyle = '#ffd700';
		ctx.font = 'bold 32px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(formatSourceType(sourceType), 256, 48);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		loadedTextures.push(texture);
		return texture;
	}

	function createTitleTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 128;
		const ctx = canvas.getContext('2d')!;

		// Transparent background
		ctx.clearRect(0, 0, 512, 128);

		// Draw title text
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 36px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Word wrap title
		const words = title.split(' ');
		const lines: string[] = [];
		let currentLine = '';
		const maxWidth = 480;

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

		// Limit to 2 lines max
		const displayLines = lines.slice(0, 2);
		if (lines.length > 2) {
			displayLines[1] = displayLines[1].slice(0, -3) + '...';
		}

		const lineHeight = 40;
		const totalHeight = displayLines.length * lineHeight;
		const startY = (128 - totalHeight) / 2 + lineHeight / 2;

		displayLines.forEach((line, i) => {
			ctx.fillText(line, 256, startY + i * lineHeight);
		});

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		loadedTextures.push(texture);
		return texture;
	}

	function createFallbackTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 768;
		const ctx = canvas.getContext('2d')!;

		// Gradient background
		const gradient = ctx.createLinearGradient(0, 0, 0, 768);
		gradient.addColorStop(0, '#1a1a2e');
		gradient.addColorStop(0.5, '#16213e');
		gradient.addColorStop(1, '#0f3460');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 768);

		// Decorative border
		ctx.strokeStyle = '#e94560';
		ctx.lineWidth = 8;
		ctx.strokeRect(20, 20, 472, 728);

		// Inner border
		ctx.strokeStyle = '#ffd700';
		ctx.lineWidth = 2;
		ctx.strokeRect(35, 35, 442, 698);

		// Title
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 42px Arial';
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

		const lineHeight = 50;
		const startY = 384 - ((lines.length - 1) * lineHeight) / 2;
		lines.forEach((line, i) => {
			ctx.fillText(line, 256, startY + i * lineHeight);
		});

		// "BOOSTER PACK" text at bottom
		ctx.fillStyle = '#ffd700';
		ctx.font = 'bold 28px Arial';
		ctx.fillText('BOOSTER PACK', 256, 680);

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
		camera.position.set(0, 0, 8);
		camera.lookAt(0, 0, 0);

		// Renderer
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			logarithmicDepthBuffer: true
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

		// Rim light for metallic highlights
		const rimLight = new THREE.DirectionalLight(0xffd700, 0.4);
		rimLight.position.set(0, -2, -3);
		scene.add(rimLight);

		// Load booster pack model
		await loadBoosterPackModel();

		// Start animation loop
		animate();
	}

	async function loadBoosterPackModel() {
		if (!scene) return;

		// Load cover image texture
		let imageTexture: THREE.Texture | null = null;
		if (source.coverImage) {
			try {
				const image = await loadImage(source.coverImage);
				imageTexture = createImageTexture(image);
			} catch {
				// Will use fallback
			}
		}

		// Create title texture
		const titleTexture = createTitleTexture(source.title);

		// Create source type texture
		const typeTexture = createTypeTexture(source.sourceType);

		// Load GLTF model
		const loader = new GLTFLoader();

		return new Promise<void>((resolve, reject) => {
			loader.load(
				'/model/booster_pack_tcg_pack/scene.gltf',
				(gltf) => {
					packGroup = new THREE.Group();
					const model = gltf.scene;

					// Traverse the model to find meshes and apply textures
					model.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							// Object_6 is the flat card surface (Plane) - apply source cover
							// Object_4 is the wrapper (Cube) - keep metallic
							if (child.name === 'Object_6') {
								// This is the card/artwork surface
								if (imageTexture) {
									child.material = new THREE.MeshStandardMaterial({
										map: imageTexture,
										metalness: 0.1,
										roughness: 0.4,
										side: THREE.DoubleSide
									});
								} else {
									// Fallback: use a simple colored material
									child.material = new THREE.MeshStandardMaterial({
										map: createFallbackTexture(source.title),
										metalness: 0.1,
										roughness: 0.4,
										side: THREE.DoubleSide
									});
								}
							} else if (child.name === 'Object_4') {
								// This is the metallic wrapper
								child.material = new THREE.MeshStandardMaterial({
									color: new THREE.Color(wrapperColor),
									metalness: 0.85,
									roughness: 0.2,
									envMapIntensity: 1.0
								});
							}
						}
					});

					// Scale and position the model appropriately
					model.scale.set(0.8, 0.8, 0.8);

					packGroup.add(model);

					// Add source type label as a plane above the image area
					const typeGeometry = new THREE.PlaneGeometry(3.2, 0.6);
					const typeMaterial = new THREE.MeshBasicMaterial({
						map: typeTexture,
						transparent: true,
						side: THREE.DoubleSide,
						depthWrite: false
					});
					const typeMesh = new THREE.Mesh(typeGeometry, typeMaterial);

					// Position the type label above the image area on the front of the pack
					typeMesh.position.set(0, 2.1, 0.08);

					packGroup.add(typeMesh);

					// Add title text as a plane below the image area
					const titleGeometry = new THREE.PlaneGeometry(3.2, 0.8);
					const titleMaterial = new THREE.MeshBasicMaterial({
						map: titleTexture,
						transparent: true,
						side: THREE.DoubleSide,
						depthWrite: false
					});
					const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);

					// Position the title below the image area on the front of the pack
					titleMesh.position.set(0, -2.1, 0.08);

					packGroup.add(titleMesh);

					packGroup.rotation.y = rotationY;
					packGroup.rotation.x = rotationX;

					scene!.add(packGroup);
					resolve();
				},
				undefined,
				(error) => {
					console.error('Failed to load booster pack model:', error);
					reject(error);
				}
			);
		});
	}

	function animate() {
		if (!renderer || !scene || !camera) return;

		animationId = requestAnimationFrame(animate);

		// Hover animation
		const targetHover = isHovering ? 1 : 0;
		hoverProgress += (targetHover - hoverProgress) * 0.1;

		if (packGroup) {
			if (autoRotate && !isDragging) {
				rotationY += 0.005;
			}
			packGroup.rotation.y = rotationY;
			packGroup.rotation.x = rotationX;

			// Scale up slightly on hover
			const baseScale = 0.8;
			const scale = baseScale + hoverProgress * 0.04;
			packGroup.scale.set(scale, scale, scale);
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

	function handleMouseEnter() {
		if (interactive) {
			isHovering = true;
		}
	}

	function handleMouseLeave() {
		isDragging = false;
		isHovering = false;
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
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		onclick={handleClick}
		role={interactive ? 'button' : undefined}
		tabindex={interactive ? 0 : undefined}
	></div>
</div>
