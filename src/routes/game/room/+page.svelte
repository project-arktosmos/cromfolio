<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { getAlbumCollection } from '$services/albums.service';
	import { playerAlbumsService } from '$services/player-albums.service';
	import type { Album } from '$types/album.type';

	let container: HTMLDivElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let animationId: number;
	let loadedTextures: THREE.Texture[] = [];

	// Player albums state
	let ownedAlbums: Album[] = $state([]);
	let isLoading = $state(true);
	let albumBooks: THREE.Group[] = [];

	// Camera rotation state - right-click drag to look around
	let isDragging = $state(false);
	let yaw = 0;
	let pitch = 0;
	const maxPitch = Math.PI / 3;
	const sensitivity = 0.003;
	let lastMouseX = 0;
	let lastMouseY = 0;

	// Raycaster for book interaction
	let raycaster: THREE.Raycaster;
	const mouse = new THREE.Vector2();
	let hoveredBook: THREE.Group | null = $state(null);
	let selectedAlbum: Album | null = $state(null);
	let selectedBook: THREE.Group | null = null;

	// Animation settings
	const ANIMATION_SPEED = 0.08;

	// Book dimensions (scaled for desk visibility)
	const BOOK_WIDTH = 0.35;
	const BOOK_HEIGHT = 0.45;
	const BOOK_DEPTH = 0.06;
	const COVER_THICKNESS = 0.008;

	function getProxiedUrl(url: string): string {
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return `/api/image-proxy?url=${encodeURIComponent(url)}`;
		}
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
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// Gradient background
		const gradient = ctx.createLinearGradient(0, 0, 0, 256);
		gradient.addColorStop(0, '#4a5568');
		gradient.addColorStop(1, '#2d3748');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 256, 256);

		// Border
		ctx.strokeStyle = '#718096';
		ctx.lineWidth = 4;
		ctx.strokeRect(10, 10, 236, 236);

		// Title
		ctx.fillStyle = '#e2e8f0';
		ctx.font = 'bold 18px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Word wrap title
		const words = title.split(' ');
		const lines: string[] = [];
		let currentLine = '';
		const maxWidth = 200;

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

		const lineHeight = 22;
		const startY = 128 - ((lines.length - 1) * lineHeight) / 2;
		lines.slice(0, 5).forEach((line, i) => {
			ctx.fillText(line, 128, startY + i * lineHeight);
		});

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function createSpineTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// Dark spine color
		ctx.fillStyle = '#1a202c';
		ctx.fillRect(0, 0, 64, 256);

		// Add title text rotated
		ctx.save();
		ctx.translate(32, 128);
		ctx.rotate(-Math.PI / 2);
		ctx.fillStyle = '#c0a060';
		ctx.font = 'bold 16px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const maxLength = 20;
		const displayTitle = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
		ctx.fillText(displayTitle, 0, 0);
		ctx.restore();

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	function createPageTexture(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 128;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// Cream colored pages
		ctx.fillStyle = '#f5f5dc';
		ctx.fillRect(0, 0, 128, 256);

		// Draw horizontal lines to simulate page edges
		ctx.strokeStyle = '#e0e0c0';
		ctx.lineWidth = 1;
		for (let i = 0; i < 256; i += 4) {
			ctx.beginPath();
			ctx.moveTo(0, i);
			ctx.lineTo(128, i);
			ctx.stroke();
		}

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	async function createAlbumBook(album: Album): Promise<THREE.Group> {
		const bookGroup = new THREE.Group();

		// Load or create cover texture
		let coverTexture: THREE.Texture;
		if (album.coverImage) {
			try {
				coverTexture = await loadCoverTexture(album.coverImage);
			} catch {
				coverTexture = createFallbackCoverTexture(album.title);
			}
		} else {
			coverTexture = createFallbackCoverTexture(album.title);
		}

		const pageTexture = createPageTexture();
		const spineTexture = createSpineTexture(album.title);

		// Page block (inner pages)
		const pageBlockWidth = BOOK_WIDTH - 0.01;
		const pageBlockDepth = BOOK_DEPTH - COVER_THICKNESS * 2;
		const pageBlockGeometry = new THREE.BoxGeometry(pageBlockWidth, BOOK_HEIGHT - 0.005, pageBlockDepth);
		const pageBlockMaterial = new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.9 });
		const pageBlock = new THREE.Mesh(pageBlockGeometry, pageBlockMaterial);
		pageBlock.position.x = 0.005;
		pageBlock.castShadow = true;
		bookGroup.add(pageBlock);

		// Spine
		const spineGeometry = new THREE.BoxGeometry(COVER_THICKNESS, BOOK_HEIGHT, BOOK_DEPTH);
		const spineMaterial = new THREE.MeshStandardMaterial({ map: spineTexture, roughness: 0.7 });
		const spine = new THREE.Mesh(spineGeometry, spineMaterial);
		spine.position.x = -BOOK_WIDTH / 2 - COVER_THICKNESS / 2;
		spine.castShadow = true;
		bookGroup.add(spine);

		// Back cover (stationary)
		const coverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS);
		const backCoverMaterial = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 });
		const backCover = new THREE.Mesh(coverGeometry, backCoverMaterial);
		backCover.position.z = -BOOK_DEPTH / 2;
		backCover.castShadow = true;
		bookGroup.add(backCover);

		// Front cover pivot - positioned at the spine edge (hinge point)
		// The pivot is at the left edge of the cover where it meets the spine
		const frontCoverPivot = new THREE.Group();
		frontCoverPivot.position.set(-BOOK_WIDTH / 2, 0, BOOK_DEPTH / 2);
		bookGroup.add(frontCoverPivot);

		// Front cover - offset so its left edge is at the pivot point
		const frontCoverMaterials = [
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // right
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // left
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // top
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // bottom
			new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.5 }), // front (cover image)
			new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.7 }) // back (inside cover)
		];
		const frontCover = new THREE.Mesh(coverGeometry, frontCoverMaterials);
		// Position so the left edge aligns with pivot (center + half width)
		frontCover.position.x = BOOK_WIDTH / 2;
		frontCover.castShadow = true;
		frontCoverPivot.add(frontCover);

		// Store references for animation
		bookGroup.userData = {
			album,
			frontCoverPivot,
			// Original position/rotation for returning to desk
			originalPosition: new THREE.Vector3(),
			originalRotation: new THREE.Euler(),
			// Target position/rotation for animation
			targetPosition: new THREE.Vector3(),
			targetRotation: new THREE.Euler(),
			// Animation state
			isSelected: false,
			isAnimating: false
		};

		return bookGroup;
	}

	function createRoom(): THREE.Group {
		const room = new THREE.Group();
		const roomWidth = 8;
		const roomHeight = 4;
		const roomDepth = 10;

		// Floor
		const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
		const floorMaterial = new THREE.MeshStandardMaterial({
			color: 0x8b7355,
			roughness: 0.8
		});
		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = 0;
		floor.receiveShadow = true;
		room.add(floor);

		// Ceiling
		const ceilingGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
		const ceilingMaterial = new THREE.MeshStandardMaterial({
			color: 0xf5f5f5,
			roughness: 0.9
		});
		const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.y = roomHeight;
		room.add(ceiling);

		// Walls
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: 0xe8e4de,
			roughness: 0.9
		});

		// Back wall
		const backWallGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
		const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
		backWall.position.set(0, roomHeight / 2, -roomDepth / 2);
		room.add(backWall);

		// Front wall (behind player)
		const frontWall = new THREE.Mesh(backWallGeometry, wallMaterial);
		frontWall.position.set(0, roomHeight / 2, roomDepth / 2);
		frontWall.rotation.y = Math.PI;
		room.add(frontWall);

		// Left wall
		const sideWallGeometry = new THREE.PlaneGeometry(roomDepth, roomHeight);
		const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
		leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
		leftWall.rotation.y = Math.PI / 2;
		room.add(leftWall);

		// Right wall
		const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
		rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
		rightWall.rotation.y = -Math.PI / 2;
		room.add(rightWall);

		return room;
	}

	function createDesk(): THREE.Group {
		const desk = new THREE.Group();
		const deskColor = 0x5c4033;

		// Desktop surface - made wider to fit albums
		const topGeometry = new THREE.BoxGeometry(2.5, 0.08, 1.2);
		const woodMaterial = new THREE.MeshStandardMaterial({
			color: deskColor,
			roughness: 0.6
		});
		const top = new THREE.Mesh(topGeometry, woodMaterial);
		top.position.y = 0.75;
		top.castShadow = true;
		top.receiveShadow = true;
		desk.add(top);

		// Legs
		const legGeometry = new THREE.BoxGeometry(0.08, 0.75, 0.08);
		const legPositions = [
			[-1.15, 0.375, -0.5],
			[1.15, 0.375, -0.5],
			[-1.15, 0.375, 0.5],
			[1.15, 0.375, 0.5]
		];

		legPositions.forEach(([x, y, z]) => {
			const leg = new THREE.Mesh(legGeometry, woodMaterial);
			leg.position.set(x, y, z);
			leg.castShadow = true;
			desk.add(leg);
		});

		return desk;
	}

	function createChair(): THREE.Group {
		const chair = new THREE.Group();
		const chairMaterial = new THREE.MeshStandardMaterial({
			color: 0x2d2d2d,
			roughness: 0.7
		});

		// Seat
		const seatGeometry = new THREE.BoxGeometry(0.5, 0.08, 0.5);
		const seat = new THREE.Mesh(seatGeometry, chairMaterial);
		seat.position.y = 0.45;
		chair.add(seat);

		// Backrest
		const backrestGeometry = new THREE.BoxGeometry(0.5, 0.6, 0.08);
		const backrest = new THREE.Mesh(backrestGeometry, chairMaterial);
		backrest.position.set(0, 0.79, 0.21);
		chair.add(backrest);

		// Chair base
		const baseGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.35);
		const base = new THREE.Mesh(
			baseGeometry,
			new THREE.MeshStandardMaterial({ color: 0x444444 })
		);
		base.position.y = 0.175;
		chair.add(base);

		// Chair wheels base
		const wheelBaseGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.03);
		const wheelBase = new THREE.Mesh(
			wheelBaseGeometry,
			new THREE.MeshStandardMaterial({ color: 0x444444 })
		);
		wheelBase.position.y = 0.015;
		chair.add(wheelBase);

		return chair;
	}

	function setupLighting(): void {
		// Strong ambient light for overall brightness
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
		scene.add(ambientLight);

		// Main overhead light - bright and directly above desk
		const overheadLight = new THREE.PointLight(0xffffff, 1.5, 20);
		overheadLight.position.set(0, 3.5, -2);
		overheadLight.castShadow = true;
		overheadLight.shadow.mapSize.width = 1024;
		overheadLight.shadow.mapSize.height = 1024;
		scene.add(overheadLight);

		// Secondary fill light from the front
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
		fillLight.position.set(0, 2, 2);
		fillLight.target.position.set(0, 0.75, -2);
		scene.add(fillLight);
		scene.add(fillLight.target);

		// Desk spotlight for the books
		const deskLight = new THREE.SpotLight(0xfff8e6, 1.2, 6, Math.PI / 4);
		deskLight.position.set(0, 2.5, -1);
		deskLight.target.position.set(0, 0.75, -1.8);
		deskLight.castShadow = true;
		scene.add(deskLight);
		scene.add(deskLight.target);
	}

	async function placeAlbumsOnDesk(): Promise<void> {
		// Remove existing album books
		albumBooks.forEach((book) => {
			scene.remove(book);
			book.traverse((obj) => {
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
		albumBooks = [];

		if (ownedAlbums.length === 0) return;

		// Desk position
		const deskX = 0;
		const deskZ = -2;
		const deskTopY = 0.75 + 0.04; // Desk height + half desk thickness

		// Calculate layout - albums in a row on the desk
		const maxAlbumsPerRow = 5;
		const albumsToShow = ownedAlbums.slice(0, maxAlbumsPerRow);
		const spacing = 0.45;
		const totalWidth = (albumsToShow.length - 1) * spacing;
		const startX = -totalWidth / 2;

		for (let i = 0; i < albumsToShow.length; i++) {
			const album = albumsToShow[i];
			const book = await createAlbumBook(album);

			// Position book on desk - laying flat with cover facing up
			book.rotation.x = -Math.PI / 2; // Lay flat
			book.rotation.z = (Math.random() - 0.5) * 0.15; // Slight random rotation for natural look

			// Stack slightly if many books
			const stackHeight = i * 0.003;
			book.position.set(
				deskX + startX + i * spacing,
				deskTopY + BOOK_DEPTH / 2 + stackHeight,
				deskZ + 0.2 // Closer to player, in front of monitor
			);

			// Store original position/rotation
			book.userData.originalPosition.copy(book.position);
			book.userData.originalRotation.copy(book.rotation);
			book.userData.targetPosition.copy(book.position);
			book.userData.targetRotation.copy(book.rotation);

			scene.add(book);
			albumBooks.push(book);
		}
	}

	async function initScene(): Promise<void> {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a2e);

		camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
		// Position camera close to desk, slightly above desk height, looking down at books
		camera.position.set(0, 1.4, -0.8);

		// Set initial pitch to look down at the desk
		pitch = -0.35; // Look slightly downward

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		container.appendChild(renderer.domElement);

		// Initialize raycaster for book interaction
		raycaster = new THREE.Raycaster();

		// Create room elements
		const room = createRoom();
		scene.add(room);

		const desk = createDesk();
		desk.position.set(0, 0, -2);
		scene.add(desk);

		// No chair - player is standing/sitting at desk
		setupLighting();

		// Place albums on desk
		await placeAlbumsOnDesk();

		// Apply initial camera rotation
		updateCameraRotation();
	}

	function updateCameraRotation(): void {
		const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
		camera.quaternion.setFromEuler(euler);
	}

	function onMouseMove(event: MouseEvent): void {
		if (!container) return;

		const rect = container.getBoundingClientRect();
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		// Camera rotation with right-click drag
		if (isDragging) {
			const deltaX = event.clientX - lastMouseX;
			const deltaY = event.clientY - lastMouseY;

			yaw -= deltaX * sensitivity;
			pitch -= deltaY * sensitivity;
			pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

			updateCameraRotation();

			lastMouseX = event.clientX;
			lastMouseY = event.clientY;
		}

		// Update hover state for books
		if (raycaster && camera && albumBooks.length > 0) {
			raycaster.setFromCamera(mouse, camera);
			const intersects = raycaster.intersectObjects(albumBooks, true);
			hoveredBook = getBookFromIntersection(intersects);
		}
	}

	function onMouseDown(event: MouseEvent): void {
		if (event.button === 2) {
			// Right-click: start camera drag
			isDragging = true;
			lastMouseX = event.clientX;
			lastMouseY = event.clientY;
		}
	}

	function onMouseUp(event: MouseEvent): void {
		if (event.button === 2) {
			isDragging = false;
		}
	}

	function onContextMenu(event: Event): void {
		event.preventDefault();
	}

	function getBookFromIntersection(intersects: THREE.Intersection[]): THREE.Group | null {
		for (const intersect of intersects) {
			let obj: THREE.Object3D | null = intersect.object;
			while (obj) {
				if (albumBooks.includes(obj as THREE.Group)) {
					return obj as THREE.Group;
				}
				obj = obj.parent;
			}
		}
		return null;
	}

	function animate(): void {
		animationId = requestAnimationFrame(animate);

		// Animate book position/rotation
		for (const book of albumBooks) {
			const userData = book.userData;

			// Animate position
			const posDiff = userData.targetPosition.clone().sub(book.position);
			if (posDiff.length() > 0.001) {
				book.position.add(posDiff.multiplyScalar(ANIMATION_SPEED));
				userData.isAnimating = true;
			} else {
				book.position.copy(userData.targetPosition);
			}

			// Animate rotation
			const rotXDiff = userData.targetRotation.x - book.rotation.x;
			const rotYDiff = userData.targetRotation.y - book.rotation.y;
			const rotZDiff = userData.targetRotation.z - book.rotation.z;

			if (Math.abs(rotXDiff) > 0.001 || Math.abs(rotYDiff) > 0.001 || Math.abs(rotZDiff) > 0.001) {
				book.rotation.x += rotXDiff * ANIMATION_SPEED;
				book.rotation.y += rotYDiff * ANIMATION_SPEED;
				book.rotation.z += rotZDiff * ANIMATION_SPEED;
				userData.isAnimating = true;
			} else {
				book.rotation.copy(userData.targetRotation);
				userData.isAnimating = false;
			}
		}

		// Update cursor based on hover state
		if (container) {
			container.style.cursor = hoveredBook ? 'pointer' : isDragging ? 'grabbing' : 'grab';
		}

		renderer.render(scene, camera);
	}

	function selectBook(book: THREE.Group): void {
		const userData = book.userData;

		// If already selected, deselect it
		if (userData.isSelected) {
			deselectBook(book);
			return;
		}

		// Deselect any previously selected book
		if (selectedBook && selectedBook !== book) {
			deselectBook(selectedBook);
		}

		// Mark as selected
		userData.isSelected = true;
		selectedBook = book;
		selectedAlbum = userData.album;

		// Calculate position in front of camera
		// Get camera's forward direction
		const forward = new THREE.Vector3(0, 0, -1);
		forward.applyQuaternion(camera.quaternion);

		// Position the book in front of the camera, vertically centered
		const targetPos = camera.position.clone().add(forward.multiplyScalar(0.6));
		targetPos.y = camera.position.y - 0.2; // Vertically centered in view

		userData.targetPosition.copy(targetPos);

		// Rotate to face the camera (standing upright, cover facing user)
		// The front cover texture is on the +Z face, so we rotate by yaw to face the camera
		// Tilt the top of the book away from the player so the cover faces upward
		userData.targetRotation.set(-0.35, yaw, 0);
	}

	function deselectBook(book: THREE.Group): void {
		const userData = book.userData;

		userData.isSelected = false;
		if (selectedBook === book) {
			selectedBook = null;
			selectedAlbum = null;
		}

		// Return to original position on desk
		userData.targetPosition.copy(userData.originalPosition);
		userData.targetRotation.copy(userData.originalRotation);
	}

	function onBookClick(event: MouseEvent): void {
		// Only handle left-click for book interaction
		if (event.button !== 0) return;

		// Calculate mouse position in normalized device coordinates
		const rect = container.getBoundingClientRect();
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		raycaster.setFromCamera(mouse, camera);

		// Check for intersections with album books
		const intersects = raycaster.intersectObjects(albumBooks, true);
		const bookGroup = getBookFromIntersection(intersects);

		if (bookGroup) {
			selectBook(bookGroup);
		} else if (selectedBook) {
			// Clicked on empty space, deselect current book
			deselectBook(selectedBook);
		}
	}

	function onResize(): void {
		if (!container || !camera || !renderer) return;

		camera.aspect = container.clientWidth / container.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(container.clientWidth, container.clientHeight);
	}

	async function loadOwnedAlbums(): Promise<void> {
		const allAlbums = await getAlbumCollection();
		const ownedAlbumIds = new Set(playerAlbumsService.all().map((o) => o.albumId));
		ownedAlbums = allAlbums.filter((album) => ownedAlbumIds.has(album.id));
		isLoading = false;
	}

	onMount(async () => {
		await loadOwnedAlbums();
		await initScene();
		animate();

		// Subscribe to player albums changes
		const unsubscribe = playerAlbumsService.store.subscribe(async () => {
			await loadOwnedAlbums();
			if (scene) {
				await placeAlbumsOnDesk();
			}
		});

		container.addEventListener('mousemove', onMouseMove);
		container.addEventListener('mousedown', onMouseDown);
		container.addEventListener('mouseup', onMouseUp);
		container.addEventListener('click', onBookClick);
		container.addEventListener('contextmenu', onContextMenu);
		window.addEventListener('resize', onResize);

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}

		if (container) {
			container.removeEventListener('mousemove', onMouseMove);
			container.removeEventListener('mousedown', onMouseDown);
			container.removeEventListener('mouseup', onMouseUp);
			container.removeEventListener('click', onBookClick);
			container.removeEventListener('contextmenu', onContextMenu);
		}
		window.removeEventListener('resize', onResize);

		// Cleanup textures
		loadedTextures.forEach((t) => t.dispose());

		// Cleanup album books
		albumBooks.forEach((book) => {
			book.traverse((obj) => {
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

		if (renderer) {
			renderer.dispose();
		}
	});
</script>

<div class="flex flex-col h-full">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-2xl font-bold">Room</h1>
			<p class="text-sm text-base-content/60">
				{#if isLoading}
					Loading albums...
				{:else if ownedAlbums.length === 0}
					No albums owned yet. Acquire albums from the Album page.
				{:else if selectedAlbum}
					<span class="text-primary font-medium">{selectedAlbum.title}</span>
				{:else}
					{ownedAlbums.length} album{ownedAlbums.length !== 1 ? 's' : ''} on your desk
				{/if}
			</p>
		</div>
		<div class="text-sm text-base-content/60">
			<span class="badge badge-ghost">Left-click</span> album to pick up ·
			<span class="badge badge-ghost">Right-drag</span> to look around
		</div>
	</div>

	<div
		bind:this={container}
		class="flex-1 rounded-lg overflow-hidden min-h-[500px]"
		role="application"
		aria-label="3D Room View"
		tabindex="0"
	></div>
</div>
