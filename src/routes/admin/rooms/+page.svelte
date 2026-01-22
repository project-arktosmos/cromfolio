<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { getAllRooms, createRoom, updateRoom, deleteRoom } from '$services/room.service';
	import { getAllFurniture } from '$services/furniture.service';
	import { DEFAULT_ROOM, type Room, type RoomFurniture } from '$types/room.type';
	import type { Furniture } from '$types/furniture.type';

	// List state
	let roomList: Room[] = $state([]);
	let furnitureList: Furniture[] = $state([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let selectedRoom = $state<Room | null>(null);

	// Form state
	let isEditing = $state(false);
	let formName = $state('');
	let formDescription = $state('');

	// Dimensions
	let formDimWidth = $state(DEFAULT_ROOM.dimensions.width);
	let formDimHeight = $state(DEFAULT_ROOM.dimensions.height);
	let formDimDepth = $state(DEFAULT_ROOM.dimensions.depth);

	// Bounds
	let formBoundsMinX = $state(DEFAULT_ROOM.bounds.minX);
	let formBoundsMaxX = $state(DEFAULT_ROOM.bounds.maxX);
	let formBoundsMinZ = $state(DEFAULT_ROOM.bounds.minZ);
	let formBoundsMaxZ = $state(DEFAULT_ROOM.bounds.maxZ);

	// Colors
	let formColorFloor = $state(DEFAULT_ROOM.colors.floor);
	let formColorCeiling = $state(DEFAULT_ROOM.colors.ceiling);
	let formColorWalls = $state(DEFAULT_ROOM.colors.walls);

	// Camera
	let formCameraX = $state(DEFAULT_ROOM.cameraSpawn.position.x);
	let formCameraY = $state(DEFAULT_ROOM.cameraSpawn.position.y);
	let formCameraZ = $state(DEFAULT_ROOM.cameraSpawn.position.z);
	let formCameraPitch = $state(DEFAULT_ROOM.cameraSpawn.pitch);

	// Furniture
	let formFurniture = $state<RoomFurniture[]>([]);

	// Active tab (for room metadata section)
	let activeTab = $state<'dimensions' | 'colors' | 'camera'>('dimensions');

	// 3D Preview state
	let previewContainer: HTMLDivElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let controls: OrbitControls;
	let animationId: number;

	// Room meshes (for updating)
	let floorMesh: THREE.Mesh | null = null;
	let ceilingMesh: THREE.Mesh | null = null;
	let wallMeshes: THREE.Mesh[] = [];
	let unitGridHelpers: THREE.GridHelper[] = [];
	let boundsHelper: THREE.LineSegments | null = null;
	let cameraHelper: THREE.Group | null = null;
	let furnitureGroup: THREE.Group | null = null;
	let loadedFurnitureModels: Map<string, THREE.Group> = new Map();

	// Loading state for furniture models
	let isLoadingModels = $state(false);

	onMount(async () => {
		[roomList, furnitureList] = await Promise.all([getAllRooms(), getAllFurniture()]);
		isLoading = false;

		// Initialize 3D preview
		initPreview();

		// Build initial room
		updateRoomPreview();
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
		// Dispose loaded models
		loadedFurnitureModels.forEach((model) => {
			model.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.geometry.dispose();
					if (Array.isArray(obj.material)) {
						obj.material.forEach((m) => m.dispose());
					} else {
						obj.material.dispose();
					}
				}
			});
		});
	});

	function initPreview() {
		if (!previewContainer) return;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a2e);

		camera = new THREE.PerspectiveCamera(
			60,
			previewContainer.clientWidth / previewContainer.clientHeight,
			0.1,
			100
		);
		camera.position.set(12, 8, 12);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		previewContainer.appendChild(renderer.domElement);

		// Orbit controls
		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.target.set(0, 2, 0);

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(10, 15, 10);
		directionalLight.castShadow = true;
		directionalLight.shadow.mapSize.width = 2048;
		directionalLight.shadow.mapSize.height = 2048;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.camera.left = -20;
		directionalLight.shadow.camera.right = 20;
		directionalLight.shadow.camera.top = 20;
		directionalLight.shadow.camera.bottom = -20;
		scene.add(directionalLight);

		// Ground grid (outside room)
		const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x333333);
		gridHelper.position.y = -0.01;
		scene.add(gridHelper);

		// Furniture group
		furnitureGroup = new THREE.Group();
		scene.add(furnitureGroup);

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

	function hexToThreeColor(hex: string): THREE.Color {
		return new THREE.Color(hex);
	}

	function updateRoomPreview() {
		if (!scene) return;

		const width = formDimWidth;
		const height = formDimHeight;
		const depth = formDimDepth;

		// Remove existing room meshes
		if (floorMesh) scene.remove(floorMesh);
		if (ceilingMesh) scene.remove(ceilingMesh);
		wallMeshes.forEach((m) => scene.remove(m));
		unitGridHelpers.forEach((g) => scene.remove(g));
		if (boundsHelper) scene.remove(boundsHelper);
		if (cameraHelper) scene.remove(cameraHelper);
		wallMeshes = [];
		unitGridHelpers = [];

		// Floor
		const floorGeometry = new THREE.PlaneGeometry(width, depth);
		const floorMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(formColorFloor),
			side: THREE.DoubleSide
		});
		floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
		floorMesh.rotation.x = -Math.PI / 2;
		floorMesh.position.y = 0;
		floorMesh.receiveShadow = true;
		scene.add(floorMesh);

		// Ceiling
		const ceilingGeometry = new THREE.PlaneGeometry(width, depth);
		const ceilingMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(formColorCeiling),
			side: THREE.DoubleSide
		});
		ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
		ceilingMesh.rotation.x = Math.PI / 2;
		ceilingMesh.position.y = height;
		scene.add(ceilingMesh);

		const wallMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(formColorWalls),
			side: THREE.DoubleSide
		});

		// Back wall (at -depth/2)
		const backWallGeometry = new THREE.PlaneGeometry(width, height);
		const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
		backWall.position.set(0, height / 2, -depth / 2);
		backWall.receiveShadow = true;
		scene.add(backWall);
		wallMeshes.push(backWall);

		// Front wall (at +depth/2) - with transparency to see inside
		const frontWallMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(formColorWalls),
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 0.3
		});
		const frontWallGeometry = new THREE.PlaneGeometry(width, height);
		const frontWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
		frontWall.position.set(0, height / 2, depth / 2);
		frontWall.rotation.y = Math.PI;
		scene.add(frontWall);
		wallMeshes.push(frontWall);

		// Left wall
		const leftWallGeometry = new THREE.PlaneGeometry(depth, height);
		const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial.clone());
		leftWall.position.set(-width / 2, height / 2, 0);
		leftWall.rotation.y = Math.PI / 2;
		leftWall.receiveShadow = true;
		scene.add(leftWall);
		wallMeshes.push(leftWall);

		// Right wall - semi-transparent
		const rightWallMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(formColorWalls),
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 0.3
		});
		const rightWallGeometry = new THREE.PlaneGeometry(depth, height);
		const rightWall = new THREE.Mesh(rightWallGeometry, rightWallMaterial);
		rightWall.position.set(width / 2, height / 2, 0);
		rightWall.rotation.y = -Math.PI / 2;
		scene.add(rightWall);
		wallMeshes.push(rightWall);

		// 1x1 unit reference grids (red) for scaling
		// Floor grid
		const floorGridSize = Math.max(width, depth);
		const floorGrid = new THREE.GridHelper(floorGridSize, floorGridSize, 0xff0000, 0xff4444);
		floorGrid.position.y = 0.01;
		scene.add(floorGrid);
		unitGridHelpers.push(floorGrid);

		// Back wall grid
		const backWallGrid = new THREE.GridHelper(Math.max(width, height), Math.max(width, height), 0xff0000, 0xff4444);
		backWallGrid.rotation.x = Math.PI / 2;
		backWallGrid.position.set(0, height / 2, -depth / 2 + 0.01);
		scene.add(backWallGrid);
		unitGridHelpers.push(backWallGrid);

		// Left wall grid
		const leftWallGrid = new THREE.GridHelper(Math.max(depth, height), Math.max(depth, height), 0xff0000, 0xff4444);
		leftWallGrid.rotation.z = Math.PI / 2;
		leftWallGrid.position.set(-width / 2 + 0.01, height / 2, 0);
		scene.add(leftWallGrid);
		unitGridHelpers.push(leftWallGrid);

		// Movement bounds visualization
		const boundsGeometry = new THREE.BoxGeometry(
			formBoundsMaxX - formBoundsMinX,
			0.1,
			formBoundsMaxZ - formBoundsMinZ
		);
		const boundsEdges = new THREE.EdgesGeometry(boundsGeometry);
		boundsHelper = new THREE.LineSegments(
			boundsEdges,
			new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
		);
		boundsHelper.position.set(
			(formBoundsMaxX + formBoundsMinX) / 2,
			0.05,
			(formBoundsMaxZ + formBoundsMinZ) / 2
		);
		scene.add(boundsHelper);

		// Camera spawn visualization
		cameraHelper = new THREE.Group();

		// Camera body (cone pointing forward)
		const cameraBodyGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
		const cameraBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
		const cameraBody = new THREE.Mesh(cameraBodyGeometry, cameraBodyMaterial);
		cameraBody.rotation.x = Math.PI / 2 + formCameraPitch;
		cameraHelper.add(cameraBody);

		// Camera stand (small sphere)
		const cameraSphereGeometry = new THREE.SphereGeometry(0.1, 8, 8);
		const cameraSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff8800 });
		const cameraSphere = new THREE.Mesh(cameraSphereGeometry, cameraSphereMaterial);
		cameraHelper.add(cameraSphere);

		// View direction line
		const viewDirection = new THREE.Vector3(0, Math.sin(-formCameraPitch), -Math.cos(-formCameraPitch));
		const viewLineGeometry = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(0, 0, 0),
			viewDirection.multiplyScalar(1.5)
		]);
		const viewLine = new THREE.Line(
			viewLineGeometry,
			new THREE.LineBasicMaterial({ color: 0xffaa00 })
		);
		cameraHelper.add(viewLine);

		cameraHelper.position.set(formCameraX, formCameraY, formCameraZ);
		scene.add(cameraHelper);

		// Update furniture
		updateFurniturePreview();
	}

	async function updateFurniturePreview() {
		if (!furnitureGroup || !scene) return;

		// Clear existing furniture
		while (furnitureGroup.children.length > 0) {
			furnitureGroup.remove(furnitureGroup.children[0]);
		}

		if (formFurniture.length === 0) return;

		isLoadingModels = true;

		const loader = new GLTFLoader();

		for (const item of formFurniture) {
			const furnitureDef = furnitureList.find((f) => f.id === item.furnitureId);
			if (!furnitureDef) continue;

			try {
				let model: THREE.Group;

				// Check if already loaded
				if (loadedFurnitureModels.has(furnitureDef.modelPath)) {
					model = loadedFurnitureModels.get(furnitureDef.modelPath)!.clone();
				} else {
					const fullPath = `/model/${furnitureDef.modelPath}`;
					const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
						loader.load(fullPath, resolve, undefined, reject);
					});
					loadedFurnitureModels.set(furnitureDef.modelPath, gltf.scene.clone());
					model = gltf.scene;
				}

				// Apply furniture base scale * room placement scale
				const totalScale = furnitureDef.scale * item.scale;
				model.scale.set(totalScale, totalScale, totalScale);

				// Apply position
				model.position.set(item.position.x, item.position.y, item.position.z);

				// Apply rotation
				model.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);

				// Enable shadows
				model.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.castShadow = true;
						child.receiveShadow = true;
					}
				});

				furnitureGroup.add(model);
			} catch (error) {
				console.error(`Failed to load furniture model: ${furnitureDef.modelPath}`, error);
			}
		}

		isLoadingModels = false;
	}

	// Reactive updates - when form values change, update preview
	$effect(() => {
		// Track all form values that affect the room preview
		formDimWidth;
		formDimHeight;
		formDimDepth;
		formBoundsMinX;
		formBoundsMaxX;
		formBoundsMinZ;
		formBoundsMaxZ;
		formColorFloor;
		formColorCeiling;
		formColorWalls;
		formCameraX;
		formCameraY;
		formCameraZ;
		formCameraPitch;

		// Only update if scene is initialized
		if (scene) {
			updateRoomPreview();
		}
	});

	// Separate effect for furniture changes - use JSON.stringify to deep-track changes
	$effect(() => {
		// Deep track all furniture properties by serializing
		JSON.stringify(formFurniture);
		if (scene && furnitureGroup) {
			updateFurniturePreview();
		}
	});

	function resetForm() {
		formName = '';
		formDescription = '';
		formDimWidth = DEFAULT_ROOM.dimensions.width;
		formDimHeight = DEFAULT_ROOM.dimensions.height;
		formDimDepth = DEFAULT_ROOM.dimensions.depth;
		formBoundsMinX = DEFAULT_ROOM.bounds.minX;
		formBoundsMaxX = DEFAULT_ROOM.bounds.maxX;
		formBoundsMinZ = DEFAULT_ROOM.bounds.minZ;
		formBoundsMaxZ = DEFAULT_ROOM.bounds.maxZ;
		formColorFloor = DEFAULT_ROOM.colors.floor;
		formColorCeiling = DEFAULT_ROOM.colors.ceiling;
		formColorWalls = DEFAULT_ROOM.colors.walls;
		formCameraX = DEFAULT_ROOM.cameraSpawn.position.x;
		formCameraY = DEFAULT_ROOM.cameraSpawn.position.y;
		formCameraZ = DEFAULT_ROOM.cameraSpawn.position.z;
		formCameraPitch = DEFAULT_ROOM.cameraSpawn.pitch;
		formFurniture = [];
		isEditing = false;
		selectedRoom = null;
		activeTab = 'dimensions';
	}

	function buildRoomFromForm(): Room {
		return {
			id: selectedRoom?.id || crypto.randomUUID(),
			name: formName.trim(),
			description: formDescription.trim() || undefined,
			dimensions: {
				width: formDimWidth,
				height: formDimHeight,
				depth: formDimDepth
			},
			bounds: {
				minX: formBoundsMinX,
				maxX: formBoundsMaxX,
				minZ: formBoundsMinZ,
				maxZ: formBoundsMaxZ
			},
			colors: {
				floor: formColorFloor,
				ceiling: formColorCeiling,
				walls: formColorWalls
			},
			cameraSpawn: {
				position: { x: formCameraX, y: formCameraY, z: formCameraZ },
				pitch: formCameraPitch
			},
			furniture: formFurniture
		};
	}

	async function handleCreate() {
		if (!formName.trim() || isSaving) return;

		isSaving = true;
		const room = buildRoomFromForm();
		const result = await createRoom(room);
		if (result) {
			roomList = await getAllRooms();
			resetForm();
		}
		isSaving = false;
	}

	async function handleUpdate() {
		if (!selectedRoom || !formName.trim() || isSaving) return;

		isSaving = true;
		const room = buildRoomFromForm();
		const result = await updateRoom(room);
		if (result) {
			roomList = await getAllRooms();
			resetForm();
		}
		isSaving = false;
	}

	async function handleDelete(room: Room, event: MouseEvent) {
		event.stopPropagation();
		const success = await deleteRoom(String(room.id));
		if (success) {
			roomList = await getAllRooms();
			if (selectedRoom?.id === room.id) {
				resetForm();
			}
		}
	}

	function selectRoom(room: Room) {
		if (selectedRoom?.id === room.id && !isEditing) {
			resetForm();
		} else {
			selectedRoom = room;
			formName = room.name;
			formDescription = room.description || '';
			formDimWidth = room.dimensions.width;
			formDimHeight = room.dimensions.height;
			formDimDepth = room.dimensions.depth;
			formBoundsMinX = room.bounds.minX;
			formBoundsMaxX = room.bounds.maxX;
			formBoundsMinZ = room.bounds.minZ;
			formBoundsMaxZ = room.bounds.maxZ;
			formColorFloor = room.colors.floor;
			formColorCeiling = room.colors.ceiling;
			formColorWalls = room.colors.walls;
			formCameraX = room.cameraSpawn.position.x;
			formCameraY = room.cameraSpawn.position.y;
			formCameraZ = room.cameraSpawn.position.z;
			formCameraPitch = room.cameraSpawn.pitch;
			formFurniture = [...room.furniture];
			isEditing = true;
		}
	}

	function handleSubmit() {
		if (isEditing) {
			handleUpdate();
		} else {
			handleCreate();
		}
	}

	function addFurniture() {
		if (furnitureList.length === 0) return;
		formFurniture = [
			...formFurniture,
			{
				furnitureId: furnitureList[0].id as string,
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: 1.0
			}
		];
	}

	function removeFurniture(index: number) {
		formFurniture = formFurniture.filter((_, i) => i !== index);
	}

	function getFurnitureName(id: string): string {
		return furnitureList.find((f) => f.id === id)?.name || 'Unknown';
	}

	function focusCameraOnRoom() {
		if (!camera || !controls) return;
		const maxDim = Math.max(formDimWidth, formDimHeight, formDimDepth);
		camera.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
		controls.target.set(0, formDimHeight / 2, 0);
		controls.update();
	}

	function viewFromSpawn() {
		if (!camera || !controls) return;
		camera.position.set(formCameraX, formCameraY, formCameraZ);
		// Look forward based on pitch
		const lookTarget = new THREE.Vector3(
			formCameraX,
			formCameraY + Math.sin(formCameraPitch),
			formCameraZ - Math.cos(formCameraPitch) * 2
		);
		controls.target.copy(lookTarget);
		controls.update();
	}
</script>

<div class="flex flex-col h-full">
	<div class="mb-4">
		<h1 class="text-2xl font-bold">Room Manager</h1>
		<p class="text-sm text-base-content/60">
			Define 3D room templates with dimensions, colors, camera position, and furniture placements.
		</p>
	</div>

	<div class="grid grid-cols-12 gap-4 flex-1 min-h-0">
		<!-- Column 1: Room List -->
		<div class="col-span-2 card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-3 flex flex-col h-full">
				<h2 class="card-title text-sm mb-2">Rooms</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-sm"></span>
						</div>
					{:else if roomList.length === 0}
						<div class="text-center text-base-content/60 p-2 text-xs">
							<p>No rooms yet.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each roomList as room (room.id)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer text-xs',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-1 ring-primary': selectedRoom?.id === room.id,
											'bg-base-100': selectedRoom?.id !== room.id
										}
									)}
									onclick={() => selectRoom(room)}
									onkeydown={(e) => e.key === 'Enter' && selectRoom(room)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start justify-between gap-1">
										<div class="flex-1 min-w-0">
											<div class="font-medium truncate">{room.name}</div>
											<div class="text-base-content/50">
												{room.dimensions.width}×{room.dimensions.height}×{room.dimensions.depth}
											</div>
										</div>
										<button
											class="btn btn-ghost btn-xs text-error p-0 min-h-0 h-auto"
											onclick={(e) => handleDelete(room, e)}
											title="Delete"
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
		<div class="col-span-4 flex flex-col gap-3 overflow-hidden">
			<!-- Top Half: Room Metadata -->
			<div class="card bg-base-200 flex-1 overflow-hidden flex flex-col">
				<div class="card-body p-3 flex flex-col h-full">
					<div class="flex items-center justify-between mb-2">
						<h2 class="card-title text-sm">
							{isEditing ? 'Edit Room' : 'Add Room'}
						</h2>
						{#if isEditing}
							<button class="btn btn-ghost btn-xs" onclick={resetForm}>Cancel</button>
						{/if}
					</div>

					<div class="flex-1 overflow-y-auto">
						<!-- Name & Description -->
						<div class="grid grid-cols-2 gap-2 mb-3">
							<div class="form-control">
								<label class="label py-0" for="room-name">
									<span class="label-text text-xs">Name *</span>
								</label>
								<input
									id="room-name"
									type="text"
									placeholder="e.g., Cozy Study"
									class="input input-bordered w-full input-xs"
									bind:value={formName}
								/>
							</div>
							<div class="form-control">
								<label class="label py-0" for="room-description">
									<span class="label-text text-xs">Description</span>
								</label>
								<input
									id="room-description"
									type="text"
									placeholder="Optional..."
									class="input input-bordered w-full input-xs"
									bind:value={formDescription}
								/>
							</div>
						</div>

						<!-- Tabs for Size/Colors/Camera -->
						<div class="tabs tabs-boxed tabs-sm mb-3">
							<button
								class={classNames('tab tab-sm', { 'tab-active': activeTab === 'dimensions' })}
								onclick={() => (activeTab = 'dimensions')}
							>
								Size
							</button>
							<button
								class={classNames('tab tab-sm', { 'tab-active': activeTab === 'colors' })}
								onclick={() => (activeTab = 'colors')}
							>
								Colors
							</button>
							<button
								class={classNames('tab tab-sm', { 'tab-active': activeTab === 'camera' })}
								onclick={() => (activeTab = 'camera')}
							>
								Camera
							</button>
						</div>

						<!-- Tab Content -->
						{#if activeTab === 'dimensions'}
							<div class="space-y-3">
								<div class="grid grid-cols-3 gap-2">
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Width</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formDimWidth}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Height</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formDimHeight}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Depth</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formDimDepth}
										/>
									</div>
								</div>

								<div class="divider text-xs text-base-content/50 my-1">Movement Bounds</div>

								<div class="grid grid-cols-2 gap-2">
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Min X</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formBoundsMinX}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Max X</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formBoundsMaxX}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Min Z</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formBoundsMinZ}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Max Z</span></label>
										<input
											type="number"
											step="0.5"
											class="input input-bordered w-full input-xs"
											bind:value={formBoundsMaxZ}
										/>
									</div>
								</div>
							</div>
						{:else if activeTab === 'colors'}
							<div class="space-y-3">
								<div class="grid grid-cols-3 gap-2">
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Floor</span></label>
										<div class="flex gap-1">
											<input type="color" class="w-8 h-7 rounded cursor-pointer" bind:value={formColorFloor} />
											<input type="text" class="input input-bordered flex-1 input-xs" bind:value={formColorFloor} />
										</div>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Ceiling</span></label>
										<div class="flex gap-1">
											<input type="color" class="w-8 h-7 rounded cursor-pointer" bind:value={formColorCeiling} />
											<input type="text" class="input input-bordered flex-1 input-xs" bind:value={formColorCeiling} />
										</div>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Walls</span></label>
										<div class="flex gap-1">
											<input type="color" class="w-8 h-7 rounded cursor-pointer" bind:value={formColorWalls} />
											<input type="text" class="input input-bordered flex-1 input-xs" bind:value={formColorWalls} />
										</div>
									</div>
								</div>
							</div>
						{:else if activeTab === 'camera'}
							<div class="space-y-3">
								<div class="grid grid-cols-3 gap-2">
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Pos X</span></label>
										<input
											type="number"
											step="0.1"
											class="input input-bordered w-full input-xs"
											bind:value={formCameraX}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Pos Y</span></label>
										<input
											type="number"
											step="0.1"
											class="input input-bordered w-full input-xs"
											bind:value={formCameraY}
										/>
									</div>
									<div class="form-control">
										<label class="label py-0"><span class="label-text-alt">Pos Z</span></label>
										<input
											type="number"
											step="0.1"
											class="input input-bordered w-full input-xs"
											bind:value={formCameraZ}
										/>
									</div>
								</div>

								<div class="form-control">
									<label class="label py-0">
										<span class="label-text-alt">Pitch: {formCameraPitch.toFixed(2)} rad</span>
									</label>
									<input
										type="range"
										min="-1.5"
										max="1.5"
										step="0.05"
										class="range range-xs range-primary"
										bind:value={formCameraPitch}
									/>
								</div>
							</div>
						{/if}
					</div>

					<!-- Submit Button -->
					<div class="mt-3">
						<button
							class="btn btn-primary w-full btn-sm"
							onclick={handleSubmit}
							disabled={!formName.trim() || isSaving}
						>
							{#if isSaving}
								<span class="loading loading-spinner loading-xs"></span>
								Saving...
							{:else}
								{isEditing ? 'Update Room' : 'Add Room'}
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Bottom Half: Furniture -->
			<div class="card bg-base-200 flex-1 overflow-hidden flex flex-col">
				<div class="card-body p-3 flex flex-col h-full">
					<div class="flex items-center justify-between mb-2">
						<h2 class="card-title text-sm">Furniture ({formFurniture.length})</h2>
						{#if furnitureList.length > 0}
							<button class="btn btn-xs btn-primary" onclick={addFurniture}>
								+ Add
							</button>
						{/if}
					</div>

					<div class="flex-1 overflow-y-auto">
						{#if furnitureList.length === 0}
							<div class="alert alert-warning text-xs py-2">
								<span>No furniture defined. Create some in <a href="/admin/furniture" class="link">Furniture Manager</a> first.</span>
							</div>
						{:else if formFurniture.length === 0}
							<div class="text-center text-base-content/50 py-4 text-xs">
								<p>No furniture placed yet.</p>
								<p class="mt-1">Click "+ Add" to place furniture in this room.</p>
							</div>
						{:else}
							<div class="space-y-2">
								{#each formFurniture as item, index}
									<div class="bg-base-300 p-2 rounded-lg text-xs">
										<div class="flex items-center justify-between mb-1">
											<select
												class="select select-bordered select-xs flex-1 mr-1"
												bind:value={item.furnitureId}
											>
												{#each furnitureList as furniture}
													<option value={furniture.id}>{furniture.name}</option>
												{/each}
											</select>
											<button
												class="btn btn-ghost btn-xs text-error p-0"
												onclick={() => removeFurniture(index)}
											>
												✕
											</button>
										</div>

										<div class="grid grid-cols-4 gap-1">
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">X</span></label>
												<input
													type="number"
													step="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.position.x}
												/>
											</div>
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">Y</span></label>
												<input
													type="number"
													step="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.position.y}
												/>
											</div>
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">Z</span></label>
												<input
													type="number"
													step="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.position.z}
												/>
											</div>
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">Scale</span></label>
												<input
													type="number"
													step="0.1"
													min="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.scale}
												/>
											</div>
										</div>

										<div class="grid grid-cols-3 gap-1 mt-1">
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">Rot X</span></label>
												<input
													type="number"
													step="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.rotation.x}
												/>
											</div>
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">Rot Y</span></label>
												<input
													type="number"
													step="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.rotation.y}
												/>
											</div>
											<div>
												<label class="label py-0"><span class="label-text-alt text-[10px]">Rot Z</span></label>
												<input
													type="number"
													step="0.1"
													class="input input-bordered input-xs w-full"
													bind:value={item.rotation.z}
												/>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Column 3: 3D Preview -->
		<div class="col-span-6 card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-3 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-sm">3D Preview</h2>
					<div class="flex gap-1">
						<button class="btn btn-ghost btn-xs" onclick={focusCameraOnRoom} title="Reset camera">
							Reset View
						</button>
						<button class="btn btn-ghost btn-xs" onclick={viewFromSpawn} title="View from spawn">
							Spawn View
						</button>
					</div>
				</div>

				<div class="flex-1 relative bg-base-300 rounded-lg overflow-hidden min-h-[300px]">
					<div bind:this={previewContainer} class="absolute inset-0"></div>

					{#if isLoadingModels}
						<div class="absolute top-2 right-2 badge badge-sm badge-warning">
							<span class="loading loading-spinner loading-xs mr-1"></span>
							Loading models...
						</div>
					{/if}

					<!-- Legend -->
					<div class="absolute bottom-2 left-2 text-xs text-base-content/60 bg-base-300/80 rounded p-2">
						<div class="flex items-center gap-2 mb-1">
							<span class="w-3 h-3 rounded-full bg-green-500"></span>
							<span>Movement bounds</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="w-3 h-3 rounded-full bg-orange-500"></span>
							<span>Camera spawn</span>
						</div>
					</div>
				</div>

				<div class="mt-2 text-xs text-base-content/50">
					Drag to rotate | Scroll to zoom | Right-click to pan
				</div>
			</div>
		</div>
	</div>
</div>
