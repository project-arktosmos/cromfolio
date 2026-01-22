<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import {
		getAllFurniture,
		createFurniture,
		updateFurniture,
		deleteFurniture
	} from '$services/furniture.service';
	import { FURNITURE_TYPES, type Furniture, type FurnitureType } from '$types/furniture.type';

	// List state
	let furnitureList: Furniture[] = $state([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let selectedFurniture = $state<Furniture | null>(null);

	// Form state
	let isEditing = $state(false);
	let formName = $state('');
	let formType = $state<FurnitureType>('decoration');
	let formModelPath = $state('');
	let formScale = $state(1.0);
	let formDescription = $state('');

	// 3D Preview state
	let previewContainer: HTMLDivElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let controls: OrbitControls;
	let animationId: number;
	let currentModel: THREE.Group | null = null;
	let isModelLoading = $state(false);
	let modelError = $state<string | null>(null);

	// Model dimensions (original unscaled size)
	let originalDimensions = $state<{ width: number; height: number; depth: number } | null>(null);
	// Scaled dimensions for display/editing
	let scaledWidth = $state(0);
	let scaledHeight = $state(0);
	let scaledDepth = $state(0);

	// Available models from static folder
	let availableModels = $state<string[]>([]);

	onMount(async () => {
		furnitureList = await getAllFurniture();
		isLoading = false;

		// Scan for available models
		await scanAvailableModels();

		// Initialize 3D preview
		initPreview();
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		if (controls) {
			controls.dispose();
		}
		if (renderer) {
			renderer.dispose();
		}
	});

	async function scanAvailableModels() {
		// For now, hardcode known models - in a real app you'd scan the directory
		availableModels = [
			'ikea_linnmonalex_desk/scene.gltf',
			'ikea_billy_long/scene.gltf',
			'ikea_kallax_77x147/scene.gltf'
		];
	}

	function initPreview() {
		if (!previewContainer) return;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x2a2a3a);

		camera = new THREE.PerspectiveCamera(
			50,
			previewContainer.clientWidth / previewContainer.clientHeight,
			0.1,
			100
		);
		camera.position.set(2, 2, 2);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		previewContainer.appendChild(renderer.domElement);

		// Orbit controls for interactive preview
		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(5, 10, 7);
		directionalLight.castShadow = true;
		scene.add(directionalLight);

		// Grid helper
		const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x333333);
		scene.add(gridHelper);

		// 1x1 unit reference grid (red) for scaling - covers entire floor
		const unitGridHelper = new THREE.GridHelper(10, 10, 0xff0000, 0xff3333);
		unitGridHelper.position.y = 0.001; // Slightly above main grid to prevent z-fighting
		scene.add(unitGridHelper);

		// Axes helper
		const axesHelper = new THREE.AxesHelper(2);
		scene.add(axesHelper);

		// Animation loop
		function animate() {
			animationId = requestAnimationFrame(animate);
			controls.update();
			renderer.render(scene, camera);
		}
		animate();

		// Handle resize
		const resizeObserver = new ResizeObserver(() => {
			if (previewContainer && renderer && camera) {
				const width = previewContainer.clientWidth;
				const height = previewContainer.clientHeight;
				camera.aspect = width / height;
				camera.updateProjectionMatrix();
				renderer.setSize(width, height);
			}
		});
		resizeObserver.observe(previewContainer);
	}

	async function loadModelPreview(modelPath: string, scale: number) {
		if (!scene || !modelPath) return;

		isModelLoading = true;
		modelError = null;

		// Remove current model
		if (currentModel) {
			scene.remove(currentModel);
			currentModel.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.geometry.dispose();
					if (Array.isArray(obj.material)) {
						obj.material.forEach((m) => m.dispose());
					} else {
						obj.material.dispose();
					}
				}
			});
			currentModel = null;
		}

		const loader = new GLTFLoader();
		const fullPath = `/model/${modelPath}`;

		try {
			const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
				loader.load(fullPath, resolve, undefined, reject);
			});

			const model = gltf.scene;

			// Get original dimensions before scaling
			const originalBox = new THREE.Box3().setFromObject(model);
			const originalSize = originalBox.getSize(new THREE.Vector3());
			originalDimensions = {
				width: originalSize.x,
				height: originalSize.y,
				depth: originalSize.z
			};

			// Update scaled dimensions
			scaledWidth = originalSize.x * scale;
			scaledHeight = originalSize.y * scale;
			scaledDepth = originalSize.z * scale;

			// Apply scale
			model.scale.set(scale, scale, scale);

			// Center the model
			const box = new THREE.Box3().setFromObject(model);
			const center = box.getCenter(new THREE.Vector3());
			model.position.sub(center);
			model.position.y = -box.min.y; // Place on ground (already scaled)

			// Enable shadows
			model.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});

			scene.add(model);
			currentModel = model;

			// Fit camera to model
			const size = box.getSize(new THREE.Vector3());
			const maxDim = Math.max(size.x, size.y, size.z);
			camera.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
			controls.target.set(0, size.y / 2, 0);
			controls.update();
		} catch (error) {
			console.error('Failed to load model:', error);
			modelError = `Failed to load model: ${fullPath}`;
		} finally {
			isModelLoading = false;
		}
	}

	function resetForm() {
		formName = '';
		formType = 'decoration';
		formModelPath = '';
		formScale = 1.0;
		formDescription = '';
		isEditing = false;
		selectedFurniture = null;

		// Clear model preview
		if (currentModel && scene) {
			scene.remove(currentModel);
			currentModel = null;
		}
		modelError = null;

		// Reset dimensions
		originalDimensions = null;
		scaledWidth = 0;
		scaledHeight = 0;
		scaledDepth = 0;
	}

	async function handleCreate() {
		if (!formName.trim() || !formModelPath.trim() || isSaving) return;

		isSaving = true;
		const furniture: Furniture = {
			id: crypto.randomUUID(),
			name: formName.trim(),
			furnitureType: formType,
			modelPath: formModelPath.trim(),
			scale: formScale,
			description: formDescription.trim() || undefined
		};

		const result = await createFurniture(furniture);
		if (result) {
			furnitureList = await getAllFurniture();
			resetForm();
		}
		isSaving = false;
	}

	async function handleUpdate() {
		if (!selectedFurniture || !formName.trim() || !formModelPath.trim() || isSaving) return;

		isSaving = true;
		const updated: Furniture = {
			...selectedFurniture,
			name: formName.trim(),
			furnitureType: formType,
			modelPath: formModelPath.trim(),
			scale: formScale,
			description: formDescription.trim() || undefined
		};

		const result = await updateFurniture(updated);
		if (result) {
			furnitureList = await getAllFurniture();
			resetForm();
		}
		isSaving = false;
	}

	async function handleDelete(furniture: Furniture, event: MouseEvent) {
		event.stopPropagation();
		const success = await deleteFurniture(String(furniture.id));
		if (success) {
			furnitureList = await getAllFurniture();
			if (selectedFurniture?.id === furniture.id) {
				resetForm();
			}
		}
	}

	function selectFurniture(furniture: Furniture) {
		if (selectedFurniture?.id === furniture.id && !isEditing) {
			resetForm();
		} else {
			selectedFurniture = furniture;
			formName = furniture.name;
			formType = furniture.furnitureType;
			formModelPath = furniture.modelPath;
			formScale = furniture.scale;
			formDescription = furniture.description || '';
			isEditing = true;

			// Load model preview
			loadModelPreview(furniture.modelPath, furniture.scale);
		}
	}

	function handleSubmit() {
		if (isEditing) {
			handleUpdate();
		} else {
			handleCreate();
		}
	}

	function handleModelPathChange() {
		if (formModelPath) {
			loadModelPreview(formModelPath, formScale);
		}
	}

	function handleScaleChange() {
		if (formModelPath && currentModel) {
			loadModelPreview(formModelPath, formScale);
		}
	}

	function handleDimensionChange(dimension: 'width' | 'height' | 'depth', value: number) {
		if (!originalDimensions || value <= 0) return;

		// Calculate new scale based on the changed dimension
		let newScale: number;
		switch (dimension) {
			case 'width':
				newScale = value / originalDimensions.width;
				break;
			case 'height':
				newScale = value / originalDimensions.height;
				break;
			case 'depth':
				newScale = value / originalDimensions.depth;
				break;
		}

		formScale = Math.round(newScale * 1000) / 1000; // Round to 3 decimals

		// Update all scaled dimensions
		scaledWidth = originalDimensions.width * formScale;
		scaledHeight = originalDimensions.height * formScale;
		scaledDepth = originalDimensions.depth * formScale;

		// Reload the preview with new scale
		if (formModelPath && currentModel) {
			loadModelPreview(formModelPath, formScale);
		}
	}

	function getFurnitureTypeLabel(type: FurnitureType): string {
		return FURNITURE_TYPES.find((t) => t.id === type)?.label || type;
	}

	function getFurnitureTypeColor(type: FurnitureType): string {
		const colors: Record<FurnitureType, string> = {
			shelf: 'badge-primary',
			table: 'badge-secondary',
			door: 'badge-accent',
			window: 'badge-info',
			carpet: 'badge-warning',
			decoration: 'badge-ghost'
		};
		return colors[type] || 'badge-ghost';
	}
</script>

<div class="flex flex-col h-full">
	<div class="mb-4">
		<h1 class="text-2xl font-bold">Furniture Manager</h1>
		<p class="text-sm text-base-content/60">
			Manage 3D furniture models for the game room. Set scale and type for each model.
		</p>
	</div>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Furniture List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Furniture Items</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if furnitureList.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No furniture defined yet.</p>
							<p class="text-sm mt-1">Create furniture using the form.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each furnitureList as furniture (furniture.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedFurniture?.id === furniture.id,
											'bg-base-100': selectedFurniture?.id !== furniture.id
										}
									)}
									onclick={() => selectFurniture(furniture)}
									onkeydown={(e) => e.key === 'Enter' && selectFurniture(furniture)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="flex-1 min-w-0">
											<div class="font-medium truncate">{furniture.name}</div>
											<div class="flex items-center gap-2 mt-1">
												<span class={classNames('badge badge-xs', getFurnitureTypeColor(furniture.furnitureType))}>
													{getFurnitureTypeLabel(furniture.furnitureType)}
												</span>
												<span class="text-xs text-base-content/50">
													Scale: {furniture.scale.toFixed(2)}
												</span>
											</div>
											<div class="text-xs text-base-content/40 mt-1 truncate">
												{furniture.modelPath}
											</div>
										</div>
										<button
											class="btn btn-ghost btn-xs text-error"
											onclick={(e) => handleDelete(furniture, e)}
											title="Delete furniture"
										>
											✕
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Form -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Furniture' : 'Add Furniture'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}>Cancel</button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<!-- Name -->
						<div class="form-control">
							<label class="label" for="furniture-name">
								<span class="label-text">Name *</span>
							</label>
							<input
								id="furniture-name"
								type="text"
								placeholder="e.g., IKEA Desk"
								class="input input-bordered w-full input-sm"
								bind:value={formName}
							/>
						</div>

						<!-- Type -->
						<div class="form-control">
							<label class="label" for="furniture-type">
								<span class="label-text">Type *</span>
							</label>
							<select
								id="furniture-type"
								class="select select-bordered w-full select-sm"
								bind:value={formType}
							>
								{#each FURNITURE_TYPES as type}
									<option value={type.id}>{type.label}</option>
								{/each}
							</select>
						</div>

						<!-- Model Path -->
						<div class="form-control">
							<label class="label" for="furniture-model">
								<span class="label-text">Model Path *</span>
							</label>
							{#if availableModels.length > 0}
								<select
									id="furniture-model"
									class="select select-bordered w-full select-sm"
									bind:value={formModelPath}
									onchange={handleModelPathChange}
								>
									<option value="">Select a model...</option>
									{#each availableModels as model}
										<option value={model}>{model}</option>
									{/each}
								</select>
							{:else}
								<input
									id="furniture-model"
									type="text"
									placeholder="e.g., ikea_desk/scene.gltf"
									class="input input-bordered w-full input-sm"
									bind:value={formModelPath}
									onchange={handleModelPathChange}
								/>
							{/if}
							<label class="label">
								<span class="label-text-alt text-base-content/50">
									Path relative to /static/model/
								</span>
							</label>
						</div>

						<!-- Scale -->
						<div class="form-control">
							<label class="label" for="furniture-scale">
								<span class="label-text">Scale</span>
							</label>
							<input
								id="furniture-scale"
								type="number"
								min="0.01"
								max="100"
								step="0.01"
								class="input input-bordered w-full input-sm"
								bind:value={formScale}
								onchange={handleScaleChange}
							/>
						</div>

						<!-- Dimensions -->
						{#if originalDimensions}
							<div class="form-control">
								<label class="label">
									<span class="label-text">Dimensions (units)</span>
								</label>
								<div class="grid grid-cols-3 gap-2">
									<div>
										<label class="label py-0" for="dim-width">
											<span class="label-text-alt">Width (X)</span>
										</label>
										<input
											id="dim-width"
											type="number"
											min="0.01"
											step="0.01"
											class="input input-bordered w-full input-sm"
											value={scaledWidth.toFixed(3)}
											onchange={(e) => handleDimensionChange('width', parseFloat(e.currentTarget.value))}
										/>
									</div>
									<div>
										<label class="label py-0" for="dim-height">
											<span class="label-text-alt">Height (Y)</span>
										</label>
										<input
											id="dim-height"
											type="number"
											min="0.01"
											step="0.01"
											class="input input-bordered w-full input-sm"
											value={scaledHeight.toFixed(3)}
											onchange={(e) => handleDimensionChange('height', parseFloat(e.currentTarget.value))}
										/>
									</div>
									<div>
										<label class="label py-0" for="dim-depth">
											<span class="label-text-alt">Depth (Z)</span>
										</label>
										<input
											id="dim-depth"
											type="number"
											min="0.01"
											step="0.01"
											class="input input-bordered w-full input-sm"
											value={scaledDepth.toFixed(3)}
											onchange={(e) => handleDimensionChange('depth', parseFloat(e.currentTarget.value))}
										/>
									</div>
								</div>
								<label class="label">
									<span class="label-text-alt text-base-content/50">
										Change any dimension to auto-adjust scale
									</span>
								</label>
							</div>
						{/if}

						<!-- Description -->
						<div class="form-control">
							<label class="label" for="furniture-description">
								<span class="label-text">Description</span>
							</label>
							<textarea
								id="furniture-description"
								placeholder="Optional description..."
								class="textarea textarea-bordered w-full textarea-sm h-20"
								bind:value={formDescription}
							></textarea>
						</div>

						<!-- Submit -->
						<button
							class="btn btn-primary w-full btn-sm"
							onclick={handleSubmit}
							disabled={!formName.trim() || !formModelPath.trim() || isSaving}
						>
							{#if isSaving}
								<span class="loading loading-spinner loading-sm"></span>
								Saving...
							{:else}
								{isEditing ? 'Update Furniture' : 'Add Furniture'}
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Column 3: 3D Preview -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">3D Preview</h2>

				<div class="flex-1 relative bg-base-300 rounded-lg overflow-hidden min-h-[300px]">
					<div bind:this={previewContainer} class="absolute inset-0"></div>

					{#if isModelLoading}
						<div class="absolute inset-0 flex items-center justify-center bg-base-300/80">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{/if}

					{#if modelError}
						<div class="absolute inset-0 flex items-center justify-center bg-base-300/80">
							<div class="alert alert-error max-w-xs">
								<span class="text-sm">{modelError}</span>
							</div>
						</div>
					{/if}

					{#if !formModelPath && !isModelLoading && !modelError}
						<div class="absolute inset-0 flex items-center justify-center text-base-content/40">
							<div class="text-center">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-16 w-16 mx-auto mb-2 opacity-30"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
									/>
								</svg>
								<p class="text-sm">Select a model to preview</p>
							</div>
						</div>
					{/if}
				</div>

				<div class="mt-2 text-xs text-base-content/50">
					<p>Drag to rotate • Scroll to zoom • Right-click to pan</p>
				</div>
			</div>
		</div>
	</div>
</div>
