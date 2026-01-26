<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { getAlbumCollection } from '$services/albums.service';
	import { playerAlbumsService } from '$services/player-albums.service';
	import { getAllRooms } from '$services/room.service';
	import { getAllFurniture } from '$services/furniture.service';
	import { DEFAULT_ROOM, type Room } from '$types/room.type';
	import type { Furniture } from '$types/furniture.type';
	import type { Album } from '$types/album.type';

	let container: HTMLDivElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let animationId: number;
	let loadedTextures: THREE.Texture[] = [];

	// Room configuration loaded from database
	let currentRoom: Room | null = $state(null);
	let furnitureDefinitions: Furniture[] = [];
	let loadedFurnitureModels: Map<string, THREE.Group> = new Map();
	let roomFurnitureGroup: THREE.Group | null = null;

	// Player albums state
	let ownedAlbums: Album[] = $state([]);
	let isLoading = $state(true);
	let albumBooks: THREE.Group[] = [];

	// Booster packs state - 5 packs with randomly assigned albums
	const BOOSTER_PACK_COUNT = 5;
	let boosterPackAlbums: Album[] = $state([]);
	let boosterPacks3D: THREE.Group[] = [];
	let boosterPackBaseModel: THREE.Group | null = null;

	// Shelf state - tracks which books are on the shelf
	let shelfBooks: THREE.Group[] = [];
	let nextShelfSlot = 0;
	const SHELF_MAX_BOOKS = 10;
	const SHELF_Z = -4.85; // On the wall above the desk
	const SHELF_Y = 1.5; // Height above the desk
	const SHELF_BOOK_SPACING = 0.12;

	// Camera rotation - pointer lock FPS style
	let yaw = 0;
	let pitch = 0;
	const MOUSE_SENSITIVITY = 0.003;

	// Movement state - WASD controls
	const keysPressed: Set<string> = new Set();
	const MOVE_SPEED = 0.05;
	// Room bounds will be set from loaded room config, with defaults
	let ROOM_BOUNDS = { minX: -3.5, maxX: 3.5, minZ: -4, maxZ: 4.5 };

	// Raycaster for book interaction
	let raycaster: THREE.Raycaster;
	let hoveredBook: THREE.Group | null = $state(null);
	let selectedAlbum: Album | null = $state(null);
	let selectedBook: THREE.Group | null = null;
	let isBookOpen = $state(false);

	// Booster pack interaction state
	let selectedBoosterPack: THREE.Group | null = $state(null);
	const BOOSTER_PACK_CAMERA_OFFSET = new THREE.Vector3(0, -0.1, -0.6);

	// Booster pack cutting state
	let isCutting = $state(false);
	let isPackOpened = $state(false);

	// Drawing plane for cutting
	let cutPlane: THREE.Mesh | null = null;
	let cutCanvas: HTMLCanvasElement | null = null;
	let cutCanvasCtx: CanvasRenderingContext2D | null = null;
	let cutTexture: THREE.CanvasTexture | null = null;
	let lastDrawPoint: { x: number; y: number } | null = null;

	// Track where the red line crosses the blue guides
	let leftCrossY: number | null = null;
	let rightCrossY: number | null = null;

	// Animation settings
	const ANIMATION_SPEED = 0.08;

	// Book page state
	const TOTAL_PAGES = 10;
	let currentPage = $state(1);

	// Book dimensions (scaled for desk visibility)
	const BOOK_WIDTH = 0.35;
	const BOOK_HEIGHT = 0.45;
	const BOOK_DEPTH = 0.06;
	const COVER_THICKNESS = 0.008;

	// Edit room mode
	let isEditMode = $state(false);
	let floorGrid: THREE.GridHelper | null = null;
	let wallGrids: THREE.GridHelper[] = [];

	// Edit mode object manipulation
	let editableObjects: THREE.Object3D[] = []; // Objects that can be edited (furniture, models)
	let selectedEditObject: THREE.Object3D | null = $state(null);
	let originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();
	let boundingBoxHelper: THREE.Box3Helper | null = null;
	let rotationAxisHelper: THREE.Line | null = null;
	const EDIT_MOVE_SPEED = 0.1;
	const EDIT_ROTATE_SPEED = Math.PI / 16; // 11.25 degrees per press

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

	function createNumberedPageTexture(pageNumber: number, isLeftPage: boolean = false): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		// Cream colored page
		ctx.fillStyle = '#faf8f0';
		ctx.fillRect(0, 0, 512, 512);

		// Subtle paper texture with light lines
		ctx.strokeStyle = '#f0ede0';
		ctx.lineWidth = 1;
		for (let i = 30; i < 480; i += 24) {
			ctx.beginPath();
			ctx.moveTo(40, i);
			ctx.lineTo(472, i);
			ctx.stroke();
		}

		// Page border
		ctx.strokeStyle = '#d0c8b0';
		ctx.lineWidth = 2;
		ctx.strokeRect(20, 20, 472, 472);

		// Page number at bottom
		ctx.fillStyle = '#4a4a4a';
		ctx.font = 'bold 32px Georgia, serif';
		ctx.textAlign = isLeftPage ? 'left' : 'right';
		ctx.textBaseline = 'bottom';
		const xPos = isLeftPage ? 50 : 462;
		ctx.fillText(String(pageNumber), xPos, 480);

		// Decorative element at top
		ctx.fillStyle = '#8b7355';
		ctx.font = 'italic 24px Georgia, serif';
		ctx.textAlign = 'center';
		ctx.fillText('~ ' + pageNumber + ' ~', 256, 50);

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	// Booster pack texture creation functions
	function createBoosterPackCoverTexture(image: HTMLImageElement): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d')!;

		ctx.clearRect(0, 0, 512, 512);

		const imgAspect = image.width / image.height;
		let drawWidth: number;
		let drawHeight: number;

		if (imgAspect > 1) {
			drawHeight = 512;
			drawWidth = 512 * imgAspect;
		} else {
			drawWidth = 512;
			drawHeight = 512 / imgAspect;
		}

		const drawX = (512 - drawWidth) / 2;
		const drawY = (512 - drawHeight) / 2;

		ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		loadedTextures.push(texture);
		return texture;
	}

	function createBoosterPackFallbackTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 768;
		const ctx = canvas.getContext('2d')!;

		const gradient = ctx.createLinearGradient(0, 0, 0, 768);
		gradient.addColorStop(0, '#1a1a2e');
		gradient.addColorStop(0.5, '#16213e');
		gradient.addColorStop(1, '#0f3460');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 512, 768);

		ctx.strokeStyle = '#e94560';
		ctx.lineWidth = 8;
		ctx.strokeRect(20, 20, 472, 728);

		ctx.strokeStyle = '#ffd700';
		ctx.lineWidth = 2;
		ctx.strokeRect(35, 35, 442, 698);

		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 36px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

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
		const startY = 384 - ((lines.length - 1) * lineHeight) / 2;
		lines.forEach((line, i) => {
			ctx.fillText(line, 256, startY + i * lineHeight);
		});

		ctx.fillStyle = '#ffd700';
		ctx.font = 'bold 24px Arial';
		ctx.fillText('BOOSTER PACK', 256, 680);

		const texture = new THREE.CanvasTexture(canvas);
		loadedTextures.push(texture);
		return texture;
	}

	async function loadBoosterPackImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = (error) => reject(error);
			img.src = getProxiedUrl(url);
		});
	}

	function formatAlbumType(albumType: string): string {
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
		return typeLabels[albumType] || albumType.toUpperCase();
	}

	function createBoosterPackTypeTexture(albumType: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 96;
		const ctx = canvas.getContext('2d')!;

		ctx.clearRect(0, 0, 512, 96);

		ctx.fillStyle = '#ffd700';
		ctx.font = 'bold 32px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(formatAlbumType(albumType), 256, 48);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		loadedTextures.push(texture);
		return texture;
	}

	function createBoosterPackTitleTexture(title: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 128;
		const ctx = canvas.getContext('2d')!;

		ctx.clearRect(0, 0, 512, 128);

		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 36px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

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

	async function loadBoosterPackBaseModel(): Promise<THREE.Group | null> {
		const loader = new GLTFLoader();

		return new Promise((resolve) => {
			loader.load(
				'/model/booster_pack_tcg_pack/scene.gltf',
				(gltf) => {
					resolve(gltf.scene);
				},
				undefined,
				(error) => {
					console.error('Failed to load booster pack model:', error);
					resolve(null);
				}
			);
		});
	}

	async function createBoosterPack3D(album: Album, wrapperColor: string = '#c0c0c0'): Promise<THREE.Group> {
		const packGroup = new THREE.Group();

		// Load the base model if not already loaded
		if (!boosterPackBaseModel) {
			boosterPackBaseModel = await loadBoosterPackBaseModel();
		}

		if (!boosterPackBaseModel) {
			// Fallback: create a simple box if model fails to load
			const geometry = new THREE.BoxGeometry(0.15, 0.25, 0.02);
			const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
			const mesh = new THREE.Mesh(geometry, material);
			packGroup.add(mesh);
			packGroup.userData = { album };
			return packGroup;
		}

		// Clone the base model
		const model = boosterPackBaseModel.clone();

		// Load cover image texture
		let imageTexture: THREE.Texture | null = null;
		if (album.coverImage) {
			try {
				const image = await loadBoosterPackImage(album.coverImage);
				imageTexture = createBoosterPackCoverTexture(image);
			} catch {
				// Will use fallback
			}
		}

		// Apply textures to the model
		model.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				if (child.name === 'Object_6') {
					// Card/artwork surface
					if (imageTexture) {
						child.material = new THREE.MeshStandardMaterial({
							map: imageTexture,
							metalness: 0.1,
							roughness: 0.4,
							side: THREE.DoubleSide
						});
					} else {
						child.material = new THREE.MeshStandardMaterial({
							map: createBoosterPackFallbackTexture(album.title),
							metalness: 0.1,
							roughness: 0.4,
							side: THREE.DoubleSide
						});
					}
				} else if (child.name === 'Object_4') {
					// Metallic wrapper
					child.material = new THREE.MeshStandardMaterial({
						color: new THREE.Color(wrapperColor),
						metalness: 0.85,
						roughness: 0.2,
						envMapIntensity: 1.0
					});
				}
			}
		});

		// Scale down for room scene
		model.scale.set(0.04, 0.04, 0.04);

		packGroup.add(model);

		// Add album type label above the image area
		const typeTexture = createBoosterPackTypeTexture(album.albumType);
		const typeGeometry = new THREE.PlaneGeometry(3.2 * 0.04, 0.6 * 0.04);
		const typeMaterial = new THREE.MeshBasicMaterial({
			map: typeTexture,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const typeMesh = new THREE.Mesh(typeGeometry, typeMaterial);
		typeMesh.position.set(0, 2.1 * 0.04, 0.08 * 0.04);
		packGroup.add(typeMesh);

		// Add title text below the image area
		const titleTexture = createBoosterPackTitleTexture(album.title);
		const titleGeometry = new THREE.PlaneGeometry(3.2 * 0.04, 0.8 * 0.04);
		const titleMaterial = new THREE.MeshBasicMaterial({
			map: titleTexture,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
		titleMesh.position.set(0, -2.1 * 0.04, 0.08 * 0.04);
		packGroup.add(titleMesh);

		packGroup.userData = {
			album,
			isBoosterPack: true,
			isSelected: false,
			isAttachedToCamera: false,
			originalPosition: new THREE.Vector3(),
			originalRotation: new THREE.Euler(),
			targetPosition: new THREE.Vector3(),
			targetRotation: new THREE.Euler(),
			currentCameraOffset: new THREE.Vector3()
		};

		return packGroup;
	}

	async function placeBoosterPacksInRoom(): Promise<void> {
		// Remove existing booster packs
		boosterPacks3D.forEach((pack) => {
			scene.remove(pack);
			pack.traverse((obj) => {
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
		boosterPacks3D = [];

		if (boosterPackAlbums.length === 0) return;

		// Find table surfaces to place packs on (same as albums)
		const tableSurfaces = findTableSurfaces();

		const spacing = 0.18; // Spacing between booster packs
		const wrapperColors = ['#c0c0c0', '#ffd700', '#e94560', '#00bcd4', '#9c27b0'];

		if (tableSurfaces.length > 0) {
			// Place on the first table, next to the albums
			const table = tableSurfaces[0];

			// Albums are placed starting from table.centerX - totalAlbumWidth/2
			// with spacing of 0.45. Place booster packs to the right of albums.
			const albumSpacing = 0.45;
			const albumCount = Math.min(ownedAlbums.length, Math.floor(table.width / albumSpacing));
			const albumsTotalWidth = (albumCount - 1) * albumSpacing;
			const albumsStartX = table.centerX - albumsTotalWidth / 2;
			const albumsEndX = albumsStartX + albumsTotalWidth;

			// Start booster packs after the last album with a small gap
			const packStartX = albumsEndX + 0.35;

			for (let i = 0; i < boosterPackAlbums.length; i++) {
				const album = boosterPackAlbums[i];
				const pack = await createBoosterPack3D(album, wrapperColors[i % wrapperColors.length]);

				// Position packs in a row on the table, laying flat like the albums
				pack.position.set(
					packStartX + i * spacing,
					table.topY + 0.13, // Slightly above table surface
					table.centerZ
				);

				// Lay flat and add slight random rotation
				pack.rotation.x = -Math.PI / 2;
				pack.rotation.z = (Math.random() - 0.5) * 0.2;

				// Store original position/rotation for returning after deselect
				pack.userData.originalPosition.copy(pack.position);
				pack.userData.originalRotation.copy(pack.rotation);
				pack.userData.targetPosition.copy(pack.position);
				pack.userData.targetRotation.copy(pack.rotation);

				scene.add(pack);
				boosterPacks3D.push(pack);
			}
		} else {
			// Fallback: place on desk position
			const roomDepth = currentRoom?.dimensions.depth ?? DEFAULT_ROOM.dimensions.depth;
			const deskTopY = 0.75 + 0.04;
			const deskZ = -roomDepth / 2 + 0.6 + 0.2;

			// Place to the right of where albums would be
			const packStartX = 0.8;

			for (let i = 0; i < boosterPackAlbums.length; i++) {
				const album = boosterPackAlbums[i];
				const pack = await createBoosterPack3D(album, wrapperColors[i % wrapperColors.length]);

				pack.position.set(
					packStartX + i * spacing,
					deskTopY + 0.1,
					deskZ
				);

				pack.rotation.x = -Math.PI / 2;
				pack.rotation.z = (Math.random() - 0.5) * 0.2;

				// Store original position/rotation for returning after deselect
				pack.userData.originalPosition.copy(pack.position);
				pack.userData.originalRotation.copy(pack.rotation);
				pack.userData.targetPosition.copy(pack.position);
				pack.userData.targetRotation.copy(pack.rotation);

				scene.add(pack);
				boosterPacks3D.push(pack);
			}
		}
	}

	function selectBoosterPack(pack: THREE.Group): void {
		const userData = pack.userData;

		// If already selected, deselect it
		if (userData.isSelected) {
			deselectBoosterPack(pack);
			return;
		}

		// Deselect any previously selected book or booster pack
		if (selectedBook) {
			deselectBook(selectedBook);
		}
		if (selectedBoosterPack && selectedBoosterPack !== pack) {
			deselectBoosterPack(selectedBoosterPack);
		}

		// Mark as selected
		userData.isSelected = true;
		selectedBoosterPack = pack;

		// Attach to camera
		userData.isAttachedToCamera = true;
		userData.targetPosition.copy(BOOSTER_PACK_CAMERA_OFFSET);
		userData.currentCameraOffset.copy(BOOSTER_PACK_CAMERA_OFFSET);
	}

	function deselectBoosterPack(pack: THREE.Group): void {
		const userData = pack.userData;

		userData.isSelected = false;
		userData.isAttachedToCamera = false;

		if (selectedBoosterPack === pack) {
			selectedBoosterPack = null;
		}

		// Reset cutting state
		isCutting = false;
		isPackOpened = false;
		lastDrawPoint = null;
		leftCrossY = null;
		rightCrossY = null;
		removeCutPlane();
		removePackParts(pack);

		// Return to original position on table
		userData.targetPosition.copy(userData.originalPosition);
		userData.targetRotation.copy(userData.originalRotation);
	}

	function getBoosterPackFromIntersection(intersects: THREE.Intersection[]): THREE.Group | null {
		for (const intersect of intersects) {
			let obj: THREE.Object3D | null = intersect.object;
			while (obj) {
				if (boosterPacks3D.includes(obj as THREE.Group)) {
					return obj as THREE.Group;
				}
				obj = obj.parent;
			}
		}
		return null;
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

		// Page block (inner pages - the bulk of pages visible from the side when book is closed)
		const pageBlockWidth = BOOK_WIDTH - 0.01;
		const pageBlockDepth = BOOK_DEPTH - COVER_THICKNESS * 2;
		const pageBlockGeometry = new THREE.BoxGeometry(pageBlockWidth, BOOK_HEIGHT - 0.005, pageBlockDepth);
		const pageBlockMaterial = new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.9 });
		const pageBlock = new THREE.Mesh(pageBlockGeometry, pageBlockMaterial);
		pageBlock.position.x = 0.005;
		pageBlock.position.z = 0; // Centered between covers
		pageBlock.castShadow = true;
		bookGroup.add(pageBlock);

		// Spine
		const spineGeometry = new THREE.BoxGeometry(COVER_THICKNESS, BOOK_HEIGHT, BOOK_DEPTH);
		const spineMaterial = new THREE.MeshStandardMaterial({ map: spineTexture, roughness: 0.7 });
		const spine = new THREE.Mesh(spineGeometry, spineMaterial);
		spine.position.x = -BOOK_WIDTH / 2 - COVER_THICKNESS / 2;
		spine.castShadow = true;
		bookGroup.add(spine);

		// When opened, the book flattens out: back cover - spine - front cover all in same plane
		// We only render TWO page surfaces: one on left, one on right, with dynamic textures

		// Back cover (stationary when open, lies flat)
		const coverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS);
		const backCoverMaterial = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 });
		const backCover = new THREE.Mesh(coverGeometry, backCoverMaterial);
		backCover.position.z = -BOOK_DEPTH / 2 + COVER_THICKNESS / 2;
		backCover.castShadow = true;
		bookGroup.add(backCover);

		// Front cover pivot - hinges at the spine edge
		// When closed: front cover is on top (+Z)
		// When open: front cover rotates -180° to lie flat on the LEFT side of the spine
		const frontCoverPivot = new THREE.Group();
		frontCoverPivot.position.set(-BOOK_WIDTH / 2, 0, BOOK_DEPTH / 2);
		bookGroup.add(frontCoverPivot);

		// Front cover mesh - positioned so when rotated -180°, it lands to the LEFT of spine
		const frontCoverMaterials = [
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // right
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // left
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // top
			new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 }), // bottom
			new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.5 }), // front (+Z, cover image)
			new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.7 }) // back (-Z, inside cover)
		];
		const frontCover = new THREE.Mesh(coverGeometry, frontCoverMaterials);
		frontCover.position.x = BOOK_WIDTH / 2;
		frontCover.position.z = 0;
		frontCover.castShadow = true;
		frontCoverPivot.add(frontCover);

		// Create just TWO page surfaces that we'll update dynamically
		// These are only visible when the book is open
		const pageGeometry = new THREE.PlaneGeometry(BOOK_WIDTH - 0.02, BOOK_HEIGHT - 0.02);
		const pageZ = BOOK_DEPTH / 2 + 0.02; // Positioned above the book, closer to the player
		const pageOffsetX = BOOK_WIDTH / 2; // Distance from spine to page center
		// When book opens, it shifts right by BOOK_WIDTH/2, so we shift pages left to compensate
		const pageShiftX = -BOOK_WIDTH / 2;

		// Left page (even numbers: 2, 4, 6, 8, 10) - positioned to left of spine when open
		const leftPageTexture = createNumberedPageTexture(2, true);
		const leftPageMaterial = new THREE.MeshStandardMaterial({
			map: leftPageTexture,
			roughness: 0.9,
			side: THREE.DoubleSide
		});
		const leftPage = new THREE.Mesh(pageGeometry, leftPageMaterial);
		leftPage.position.set(-pageOffsetX + pageShiftX, 0, pageZ);
		leftPage.visible = false; // Hidden until book opens
		bookGroup.add(leftPage);

		// Right page (odd numbers: 1, 3, 5, 7, 9) - positioned to right of spine when open
		const rightPageTexture = createNumberedPageTexture(1, false);
		const rightPageMaterial = new THREE.MeshStandardMaterial({
			map: rightPageTexture,
			roughness: 0.9,
			side: THREE.DoubleSide
		});
		const rightPage = new THREE.Mesh(pageGeometry, rightPageMaterial);
		rightPage.position.set(pageOffsetX + pageShiftX, 0, pageZ);
		rightPage.visible = false; // Hidden until book opens
		bookGroup.add(rightPage);

		// Flipping page - animates between left and right
		// Uses TWO planes: front side (odd page) and back side (even page)
		// Pivot is shifted left to match page positions
		// When rotated -PI, the page lands exactly at leftPage position
		const flippingPageFrontMaterial = new THREE.MeshStandardMaterial({
			map: rightPageTexture.clone(),
			roughness: 0.9,
			side: THREE.FrontSide
		});
		const flippingPageBackMaterial = new THREE.MeshStandardMaterial({
			map: createNumberedPageTexture(2, true),
			roughness: 0.9,
			side: THREE.FrontSide
		});

		const flippingPagePivot = new THREE.Group();
		flippingPagePivot.position.set(pageShiftX, 0, pageZ); // Pivot shifted left to match pages
		bookGroup.add(flippingPagePivot);

		// Front of flipping page (faces player when on right side)
		const flippingPageFront = new THREE.Mesh(pageGeometry, flippingPageFrontMaterial);
		flippingPageFront.position.x = pageOffsetX; // Offset from pivot
		flippingPageFront.position.z = 0.001; // Slightly forward
		flippingPageFront.visible = false;
		flippingPagePivot.add(flippingPageFront);

		// Back of flipping page (faces player when flipped to left side)
		const flippingPageBack = new THREE.Mesh(pageGeometry, flippingPageBackMaterial);
		flippingPageBack.position.x = pageOffsetX; // Offset from pivot
		flippingPageBack.position.z = -0.001; // Slightly backward
		flippingPageBack.rotation.y = Math.PI; // Rotated 180° so it faces the other way
		flippingPageBack.visible = false;
		flippingPagePivot.add(flippingPageBack);

		// Store references for animation
		bookGroup.userData = {
			album,
			frontCoverPivot,
			leftPage,
			rightPage,
			leftPageMaterial,
			rightPageMaterial,
			flippingPageFront,
			flippingPageBack,
			flippingPagePivot,
			flippingPageFrontMaterial,
			flippingPageBackMaterial,
			// Original position/rotation for returning to desk
			originalPosition: new THREE.Vector3(),
			originalRotation: new THREE.Euler(),
			// Target position/rotation for animation
			targetPosition: new THREE.Vector3(),
			targetRotation: new THREE.Euler(),
			// Selected position (before opening) for centering when open
			selectedPosition: new THREE.Vector3(),
			// Current camera offset (for smooth animation when attached to camera)
			currentCameraOffset: new THREE.Vector3(),
			// Cover animation state
			targetCoverRotation: 0,
			// Page flip animation state
			isFlipping: false,
			flipDirection: 0, // -1 for left (prev), 1 for right (next)
			flipProgress: 0, // 0 to 1
			targetFlipRotation: 0,
			// Animation state
			isSelected: false,
			isAnimating: false,
			isAttachedToCamera: false
		};

		return bookGroup;
	}

	function hexToThreeColor(hex: string): THREE.Color {
		return new THREE.Color(hex);
	}

	function createRoom(): THREE.Group {
		const room = new THREE.Group();

		// Use room configuration or defaults
		const roomWidth = currentRoom?.dimensions.width ?? DEFAULT_ROOM.dimensions.width;
		const roomHeight = currentRoom?.dimensions.height ?? DEFAULT_ROOM.dimensions.height;
		const roomDepth = currentRoom?.dimensions.depth ?? DEFAULT_ROOM.dimensions.depth;

		const floorColor = currentRoom?.colors.floor ?? DEFAULT_ROOM.colors.floor;
		const ceilingColor = currentRoom?.colors.ceiling ?? DEFAULT_ROOM.colors.ceiling;
		const wallsColor = currentRoom?.colors.walls ?? DEFAULT_ROOM.colors.walls;

		// Floor
		const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
		const floorMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(floorColor),
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
			color: hexToThreeColor(ceilingColor),
			roughness: 0.9
		});
		const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.y = roomHeight;
		room.add(ceiling);

		// Walls
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: hexToThreeColor(wallsColor),
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

	function createBookshelf(): THREE.Group {
		const shelf = new THREE.Group();
		const woodColor = 0x4a3728;
		const woodMaterial = new THREE.MeshStandardMaterial({
			color: woodColor,
			roughness: 0.7
		});

		// Shelf dimensions
		const shelfWidth = 1.8;
		const shelfDepth = 0.25;
		const shelfThickness = 0.03;
		const shelfHeight = 0.6; // Height of the shelf unit
		const sideThickness = 0.04;

		// Bottom shelf (base)
		const bottomGeometry = new THREE.BoxGeometry(shelfWidth, shelfThickness, shelfDepth);
		const bottom = new THREE.Mesh(bottomGeometry, woodMaterial);
		bottom.position.y = 0;
		bottom.castShadow = true;
		bottom.receiveShadow = true;
		shelf.add(bottom);

		// Top shelf
		const top = new THREE.Mesh(bottomGeometry, woodMaterial);
		top.position.y = shelfHeight;
		top.castShadow = true;
		shelf.add(top);

		// Left side
		const sideGeometry = new THREE.BoxGeometry(sideThickness, shelfHeight, shelfDepth);
		const leftSide = new THREE.Mesh(sideGeometry, woodMaterial);
		leftSide.position.set(-shelfWidth / 2 + sideThickness / 2, shelfHeight / 2, 0);
		leftSide.castShadow = true;
		shelf.add(leftSide);

		// Right side
		const rightSide = new THREE.Mesh(sideGeometry, woodMaterial);
		rightSide.position.set(shelfWidth / 2 - sideThickness / 2, shelfHeight / 2, 0);
		rightSide.castShadow = true;
		shelf.add(rightSide);

		// Back panel
		const backGeometry = new THREE.BoxGeometry(shelfWidth, shelfHeight, 0.01);
		const backMaterial = new THREE.MeshStandardMaterial({
			color: 0x3a2a1a,
			roughness: 0.9
		});
		const back = new THREE.Mesh(backGeometry, backMaterial);
		back.position.set(0, shelfHeight / 2, -shelfDepth / 2 + 0.005);
		shelf.add(back);

		return shelf;
	}

	async function loadIkeaDesk(): Promise<THREE.Group | null> {
		const loader = new GLTFLoader();

		return new Promise((resolve) => {
			loader.load(
				'/model/ikea_linnmonalex_desk/scene.gltf',
				(gltf) => {
					const model = gltf.scene;

					// Get the bounding box to understand the model's size
					const box = new THREE.Box3().setFromObject(model);
					const size = box.getSize(new THREE.Vector3());
					const center = box.getCenter(new THREE.Vector3());

					console.log('IKEA desk original size:', size);
					console.log('IKEA desk original center:', center);

					// Target height for the desk
					const targetHeight = 1;
					const scaleFactor = targetHeight / size.y;

					model.scale.set(scaleFactor, scaleFactor, scaleFactor);

					// Recalculate after scaling
					box.setFromObject(model);
					const newSize = box.getSize(new THREE.Vector3());
					const newCenter = box.getCenter(new THREE.Vector3());

					console.log('IKEA desk scaled size:', newSize);

					// Position: place it to the right of the existing desk
					// Center it on Y so it sits on the floor, offset X to the right
					model.position.set(
						2.5 - newCenter.x, // To the right of existing desk
						-box.min.y, // Sit on the floor (y=0)
						-4.4 - newCenter.z // Same Z as existing desk
					);

					// Enable shadows on all meshes
					model.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							child.castShadow = true;
							child.receiveShadow = true;
						}
					});

					resolve(model);
				},
				undefined,
				(error) => {
					console.error('Error loading IKEA desk model:', error);
					resolve(null);
				}
			);
		});
	}

	function toggleEditMode(): void {
		isEditMode = !isEditMode;

		if (isEditMode) {
			// Use room dimensions from loaded config or defaults
			const roomWidth = currentRoom?.dimensions.width ?? DEFAULT_ROOM.dimensions.width;
			const roomDepth = currentRoom?.dimensions.depth ?? DEFAULT_ROOM.dimensions.depth;
			const roomHeight = currentRoom?.dimensions.height ?? DEFAULT_ROOM.dimensions.height;

			// Floor grid
			floorGrid = new THREE.GridHelper(Math.max(roomWidth, roomDepth), Math.max(roomWidth, roomDepth), 0xff0000, 0xff0000);
			floorGrid.position.y = 0.01; // Slightly above floor to avoid z-fighting
			scene.add(floorGrid);

			// Back wall grid
			const backWallGrid = new THREE.GridHelper(roomWidth, roomWidth, 0xff0000, 0xff0000);
			backWallGrid.rotation.x = Math.PI / 2;
			backWallGrid.position.set(0, roomHeight / 2, -roomDepth / 2 + 0.01);
			scene.add(backWallGrid);
			wallGrids.push(backWallGrid);

			// Front wall grid
			const frontWallGrid = new THREE.GridHelper(roomWidth, roomWidth, 0xff0000, 0xff0000);
			frontWallGrid.rotation.x = Math.PI / 2;
			frontWallGrid.position.set(0, roomHeight / 2, roomDepth / 2 - 0.01);
			scene.add(frontWallGrid);
			wallGrids.push(frontWallGrid);

			// Left wall grid
			const leftWallGrid = new THREE.GridHelper(roomDepth, roomDepth, 0xff0000, 0xff0000);
			leftWallGrid.rotation.z = Math.PI / 2;
			leftWallGrid.position.set(-roomWidth / 2 + 0.01, roomHeight / 2, 0);
			scene.add(leftWallGrid);
			wallGrids.push(leftWallGrid);

			// Right wall grid
			const rightWallGrid = new THREE.GridHelper(roomDepth, roomDepth, 0xff0000, 0xff0000);
			rightWallGrid.rotation.z = Math.PI / 2;
			rightWallGrid.position.set(roomWidth / 2 - 0.01, roomHeight / 2, 0);
			scene.add(rightWallGrid);
			wallGrids.push(rightWallGrid);
		} else {
			// Remove grids
			if (floorGrid) {
				scene.remove(floorGrid);
				floorGrid.dispose();
				floorGrid = null;
			}
			wallGrids.forEach((grid) => {
				scene.remove(grid);
				grid.dispose();
			});
			wallGrids = [];

			// Deselect any selected object when exiting edit mode
			if (selectedEditObject) {
				deselectEditObject();
			}
		}
	}

	function selectEditObject(obj: THREE.Object3D): void {
		// Deselect previous object if any
		if (selectedEditObject) {
			deselectEditObject();
		}

		selectedEditObject = obj;

		// Create bounding box helper
		const box = new THREE.Box3().setFromObject(obj);
		boundingBoxHelper = new THREE.Box3Helper(box, new THREE.Color(0x00ffff));
		scene.add(boundingBoxHelper);

		// Create rotation axis helper (yellow vertical line through center)
		const center = box.getCenter(new THREE.Vector3());
		const axisGeometry = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(center.x, 0, center.z),
			new THREE.Vector3(center.x, box.max.y + 0.5, center.z)
		]);
		const axisMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
		rotationAxisHelper = new THREE.Line(axisGeometry, axisMaterial);
		scene.add(rotationAxisHelper);

		// Highlight the object with a cyan tint
		obj.traverse((child) => {
			if (child instanceof THREE.Mesh && child.material) {
				// Store original material
				originalMaterials.set(child, child.material);

				// Create highlighted material
				if (Array.isArray(child.material)) {
					child.material = child.material.map((mat) => {
						const highlightMat = mat.clone();
						if ('emissive' in highlightMat) {
							(highlightMat as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x00ffff);
							(highlightMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
						}
						return highlightMat;
					});
				} else {
					const highlightMat = child.material.clone();
					if ('emissive' in highlightMat) {
						(highlightMat as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x00ffff);
						(highlightMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
					}
					child.material = highlightMat;
				}
			}
		});
	}

	function deselectEditObject(): void {
		if (!selectedEditObject) return;

		// Remove bounding box helper
		if (boundingBoxHelper) {
			scene.remove(boundingBoxHelper);
			boundingBoxHelper.dispose();
			boundingBoxHelper = null;
		}

		// Remove rotation axis helper
		if (rotationAxisHelper) {
			scene.remove(rotationAxisHelper);
			rotationAxisHelper.geometry.dispose();
			(rotationAxisHelper.material as THREE.Material).dispose();
			rotationAxisHelper = null;
		}

		// Restore original materials
		selectedEditObject.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				const originalMat = originalMaterials.get(child);
				if (originalMat) {
					// Dispose highlighted materials
					if (Array.isArray(child.material)) {
						child.material.forEach((m) => m.dispose());
					} else {
						child.material.dispose();
					}
					child.material = originalMat;
				}
			}
		});

		originalMaterials.clear();
		selectedEditObject = null;
	}

	function updateEditHelpers(): void {
		if (!selectedEditObject) return;

		const box = new THREE.Box3().setFromObject(selectedEditObject);

		// Update bounding box
		if (boundingBoxHelper) {
			boundingBoxHelper.box.copy(box);
		}

		// Update rotation axis position
		if (rotationAxisHelper) {
			const center = box.getCenter(new THREE.Vector3());
			const positions = rotationAxisHelper.geometry.attributes.position;
			positions.setXYZ(0, center.x, 0, center.z);
			positions.setXYZ(1, center.x, box.max.y + 0.5, center.z);
			positions.needsUpdate = true;
		}
	}

	function moveEditObject(dx: number, dz: number): void {
		if (!selectedEditObject) return;

		// Move in world space based on camera direction
		const forward = new THREE.Vector3(0, 0, -1);
		const right = new THREE.Vector3(1, 0, 0);

		const yawQuat = new THREE.Quaternion();
		yawQuat.setFromEuler(new THREE.Euler(0, yaw, 0));
		forward.applyQuaternion(yawQuat);
		right.applyQuaternion(yawQuat);

		selectedEditObject.position.x += right.x * dx * EDIT_MOVE_SPEED + forward.x * dz * EDIT_MOVE_SPEED;
		selectedEditObject.position.z += right.z * dx * EDIT_MOVE_SPEED + forward.z * dz * EDIT_MOVE_SPEED;

		updateEditHelpers();
	}

	function rotateEditObject(direction: number): void {
		if (!selectedEditObject) return;

		const angle = direction * EDIT_ROTATE_SPEED;

		// Get bounding box center before rotation
		const boxBefore = new THREE.Box3().setFromObject(selectedEditObject);
		const centerBefore = boxBefore.getCenter(new THREE.Vector3());

		// Rotate the object
		selectedEditObject.rotation.y += angle;

		// Get bounding box center after rotation
		const boxAfter = new THREE.Box3().setFromObject(selectedEditObject);
		const centerAfter = boxAfter.getCenter(new THREE.Vector3());

		// Compensate for any center drift caused by rotation
		// This keeps the visual center in the same place
		selectedEditObject.position.x += centerBefore.x - centerAfter.x;
		selectedEditObject.position.z += centerBefore.z - centerAfter.z;

		updateEditHelpers();
	}

	function getEditableObjectFromIntersection(intersects: THREE.Intersection[]): THREE.Object3D | null {
		for (const intersect of intersects) {
			let obj: THREE.Object3D | null = intersect.object;

			// Walk up to find the root editable object
			while (obj) {
				if (editableObjects.includes(obj)) {
					return obj;
				}
				obj = obj.parent;
			}
		}
		return null;
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

	interface TableSurface {
		centerX: number;
		centerZ: number;
		topY: number;
		width: number;
		depth: number;
	}

	function findTableSurfaces(): TableSurface[] {
		const tables: TableSurface[] = [];

		if (!currentRoom || !roomFurnitureGroup) return tables;

		// Iterate through room furniture items and find tables
		for (let i = 0; i < currentRoom.furniture.length; i++) {
			const roomFurnitureItem = currentRoom.furniture[i];
			const furnitureDef = furnitureDefinitions.find((f) => String(f.id) === roomFurnitureItem.furnitureId);

			if (!furnitureDef || furnitureDef.furnitureType !== 'table') continue;

			// Get the corresponding loaded 3D model from roomFurnitureGroup
			const model = roomFurnitureGroup.children[i];
			if (!model) continue;

			// Get the bounding box of the model to find its surface
			const box = new THREE.Box3().setFromObject(model);
			const size = box.getSize(new THREE.Vector3());
			const center = box.getCenter(new THREE.Vector3());

			tables.push({
				centerX: center.x,
				centerZ: center.z,
				topY: box.max.y,
				width: size.x,
				depth: size.z
			});
		}

		return tables;
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

		// Find all table surfaces in the room
		const tableSurfaces = findTableSurfaces();

		// If no tables found, use fallback position
		if (tableSurfaces.length === 0) {
			// Fallback: Desk position - calculate based on room dimensions
			const roomDepth = currentRoom?.dimensions.depth ?? DEFAULT_ROOM.dimensions.depth;
			const deskX = 0;
			const deskZ = -roomDepth / 2 + 0.6;
			const deskTopY = 0.75 + 0.04;

			const maxAlbumsPerRow = 5;
			const albumsToShow = ownedAlbums.slice(0, maxAlbumsPerRow);
			const spacing = 0.45;
			const totalWidth = (albumsToShow.length - 1) * spacing;
			const startX = -totalWidth / 2;

			for (let i = 0; i < albumsToShow.length; i++) {
				const album = albumsToShow[i];
				const book = await createAlbumBook(album);

				book.rotation.x = -Math.PI / 2;
				book.rotation.z = (Math.random() - 0.5) * 0.15;

				const stackHeight = i * 0.003;
				book.position.set(
					deskX + startX + i * spacing,
					deskTopY + BOOK_DEPTH / 2 + stackHeight,
					deskZ + 0.2
				);

				book.userData.originalPosition.copy(book.position);
				book.userData.originalRotation.copy(book.rotation);
				book.userData.targetPosition.copy(book.position);
				book.userData.targetRotation.copy(book.rotation);

				scene.add(book);
				albumBooks.push(book);
			}
			return;
		}

		// Distribute albums across table surfaces
		let albumIndex = 0;
		const spacing = 0.45;

		for (const table of tableSurfaces) {
			if (albumIndex >= ownedAlbums.length) break;

			// Calculate how many albums can fit on this table
			const maxAlbumsForTable = Math.floor(table.width / spacing);
			const albumsForThisTable = Math.min(
				maxAlbumsForTable,
				ownedAlbums.length - albumIndex
			);

			const totalWidth = (albumsForThisTable - 1) * spacing;
			const startX = table.centerX - totalWidth / 2;

			for (let i = 0; i < albumsForThisTable; i++) {
				const album = ownedAlbums[albumIndex];
				const book = await createAlbumBook(album);

				// Position book on table - laying flat with cover facing up
				book.rotation.x = -Math.PI / 2;
				book.rotation.z = (Math.random() - 0.5) * 0.15;

				const stackHeight = i * 0.003;
				book.position.set(
					startX + i * spacing,
					table.topY + BOOK_DEPTH / 2 + stackHeight + 0.01, // Slightly above surface
					table.centerZ // Center on table
				);

				book.userData.originalPosition.copy(book.position);
				book.userData.originalRotation.copy(book.rotation);
				book.userData.targetPosition.copy(book.position);
				book.userData.targetRotation.copy(book.rotation);

				scene.add(book);
				albumBooks.push(book);
				albumIndex++;
			}
		}
	}

	async function loadRoomConfiguration(): Promise<void> {
		try {
			// Load all rooms and furniture definitions from database
			const [rooms, furniture] = await Promise.all([getAllRooms(), getAllFurniture()]);
			furnitureDefinitions = furniture;

			// Find the "default study" room (case-insensitive search)
			// Falls back to first room, or null if no rooms exist
			currentRoom =
				rooms.find((r) => r.name.toLowerCase().includes('study') || r.name.toLowerCase().includes('default')) ||
				rooms[0] ||
				null;

			if (currentRoom) {
				// Update movement bounds from room configuration
				ROOM_BOUNDS = {
					minX: currentRoom.bounds.minX,
					maxX: currentRoom.bounds.maxX,
					minZ: currentRoom.bounds.minZ,
					maxZ: currentRoom.bounds.maxZ
				};
				console.log(`[game/room] Loaded room: "${currentRoom.name}"`);
			} else {
				console.log('[game/room] No room found in database, using defaults');
			}
		} catch (error) {
			console.error('[game/room] Failed to load room configuration:', error);
			currentRoom = null;
		}
	}

	async function loadRoomFurniture(): Promise<void> {
		if (!currentRoom || !scene || currentRoom.furniture.length === 0) return;

		// Create furniture group if it doesn't exist
		if (!roomFurnitureGroup) {
			roomFurnitureGroup = new THREE.Group();
			scene.add(roomFurnitureGroup);
		}

		// Clear existing furniture
		while (roomFurnitureGroup.children.length > 0) {
			roomFurnitureGroup.remove(roomFurnitureGroup.children[0]);
		}

		const loader = new GLTFLoader();

		for (const item of currentRoom.furniture) {
			const furnitureDef = furnitureDefinitions.find((f) => f.id === item.furnitureId);
			if (!furnitureDef) {
				console.warn(`[game/room] Furniture definition not found for ID: ${item.furnitureId}`);
				continue;
			}

			try {
				let model: THREE.Group;

				// Check if model is already cached
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

				// Make editable
				model.userData.isEditable = true;
				model.userData.name = furnitureDef.name;

				roomFurnitureGroup.add(model);
				editableObjects.push(model);
			} catch (error) {
				console.error(`[game/room] Failed to load furniture model: ${furnitureDef.modelPath}`, error);
			}
		}
	}

	async function initScene(): Promise<void> {
		// Load room configuration from database first
		await loadRoomConfiguration();

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a2e);

		camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);

		// Use camera spawn from room configuration or defaults
		const cameraSpawn = currentRoom?.cameraSpawn ?? DEFAULT_ROOM.cameraSpawn;
		camera.position.set(cameraSpawn.position.x, cameraSpawn.position.y, cameraSpawn.position.z);
		pitch = cameraSpawn.pitch;

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		container.appendChild(renderer.domElement);

		// Initialize raycaster for book interaction
		raycaster = new THREE.Raycaster();

		// Create room elements using loaded configuration
		const room = createRoom();
		scene.add(room);

		// Load furniture from room configuration (from database)
		await loadRoomFurniture();

		// If no furniture was loaded from the room config, create default furniture
		if (!currentRoom || currentRoom.furniture.length === 0) {
			const desk = createDesk();
			// Position desk against the back wall
			const roomDepth = currentRoom?.dimensions.depth ?? DEFAULT_ROOM.dimensions.depth;
			desk.position.set(0, 0, -roomDepth / 2 + 0.6);
			desk.userData.isEditable = true;
			desk.userData.name = 'Desk';
			scene.add(desk);
			editableObjects.push(desk);

			// Add bookshelf on the wall above the desk
			const bookshelf = createBookshelf();
			bookshelf.position.set(0, SHELF_Y, -roomDepth / 2 + 0.15);
			bookshelf.userData.isEditable = true;
			bookshelf.userData.name = 'Bookshelf';
			scene.add(bookshelf);
			editableObjects.push(bookshelf);

			// Load IKEA desk model next to the existing desk
			const ikeaDesk = await loadIkeaDesk();
			if (ikeaDesk) {
				ikeaDesk.userData.isEditable = true;
				ikeaDesk.userData.name = 'IKEA Desk';
				scene.add(ikeaDesk);
				editableObjects.push(ikeaDesk);
			}
		}

		setupLighting();

		// Place albums on desk
		await placeAlbumsOnDesk();

		// Place booster packs in the room
		await placeBoosterPacksInRoom();

		// Apply initial camera rotation
		updateCameraRotation();
	}

	function updateCameraRotation(): void {
		const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
		camera.quaternion.setFromEuler(euler);
	}

	// Mouse position for crosshair (in pixels relative to container)
	let mouseScreenX = $state(0);
	let mouseScreenY = $state(0);

	function onMouseMove(event: MouseEvent): void {
		if (!container || !camera) return;

		const rect = container.getBoundingClientRect();

		// Store pixel position for crosshair (relative to container)
		mouseScreenX = event.clientX - rect.left;
		mouseScreenY = event.clientY - rect.top;

		// If a booster pack is selected, block camera control
		if (selectedBoosterPack) {
			// Handle cutting if not yet opened
			if (!isPackOpened) {
				handleBoosterPackCutting(event);
			}
			return;
		}

		// Calculate mouse position relative to container (0 to 1)
		const normalizedX = mouseScreenX / rect.width;
		const normalizedY = mouseScreenY / rect.height;

		// Convert to NDC (-1 to 1) for raycasting
		const ndcX = normalizedX * 2 - 1;
		const ndcY = -(normalizedY * 2 - 1);

		// Map mouse position to camera rotation
		// Full horizontal range: mouse left edge = -180°, right edge = +180° (relative to base)
		// Vertical: top = look up, bottom = look down
		const maxYaw = Math.PI; // 180 degrees each direction
		const maxPitch = Math.PI / 2 - 0.1; // ~85 degrees up/down

		yaw = -ndcX * maxYaw;
		pitch = ndcY * maxPitch;

		updateCameraRotation();

		// Update hover state - raycast from center of screen (where camera looks)
		if (raycaster && albumBooks.length > 0) {
			raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
			const intersects = raycaster.intersectObjects(albumBooks, true);
			hoveredBook = getBookFromIntersection(intersects);
		}
	}

	function handleBoosterPackCutting(event: MouseEvent): void {
		if (!container || !selectedBoosterPack || !cutPlane) return;

		// Only draw while mouse button is held
		if (!isCutting) return;

		// Raycast to find where mouse intersects the cut plane
		const rect = container.getBoundingClientRect();
		const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
		const intersects = raycaster.intersectObject(cutPlane);

		if (intersects.length > 0 && cutCanvasCtx && cutTexture) {
			const uv = intersects[0].uv;
			if (uv) {
				// Convert UV to canvas coordinates
				const canvasX = uv.x * 512;
				const canvasY = (1 - uv.y) * 512; // Flip Y

				// Draw on canvas
				cutCanvasCtx.strokeStyle = '#ff0000';
				cutCanvasCtx.lineWidth = 8;
				cutCanvasCtx.lineCap = 'round';
				cutCanvasCtx.lineJoin = 'round';

				if (lastDrawPoint) {
					cutCanvasCtx.beginPath();
					cutCanvasCtx.moveTo(lastDrawPoint.x, lastDrawPoint.y);
					cutCanvasCtx.lineTo(canvasX, canvasY);
					cutCanvasCtx.stroke();

					// Check if line crosses the left blue guide
					if ((lastDrawPoint.x < CUT_GUIDE_LEFT_X && canvasX >= CUT_GUIDE_LEFT_X) ||
						(lastDrawPoint.x > CUT_GUIDE_LEFT_X && canvasX <= CUT_GUIDE_LEFT_X)) {
						// Interpolate Y at crossing point
						const t = (CUT_GUIDE_LEFT_X - lastDrawPoint.x) / (canvasX - lastDrawPoint.x);
						leftCrossY = lastDrawPoint.y + t * (canvasY - lastDrawPoint.y);
					}

					// Check if line crosses the right blue guide
					if ((lastDrawPoint.x < CUT_GUIDE_RIGHT_X && canvasX >= CUT_GUIDE_RIGHT_X) ||
						(lastDrawPoint.x > CUT_GUIDE_RIGHT_X && canvasX <= CUT_GUIDE_RIGHT_X)) {
						// Interpolate Y at crossing point
						const t = (CUT_GUIDE_RIGHT_X - lastDrawPoint.x) / (canvasX - lastDrawPoint.x);
						rightCrossY = lastDrawPoint.y + t * (canvasY - lastDrawPoint.y);
					}

					// Check if we've crossed both guides
					if (leftCrossY !== null && rightCrossY !== null && !isPackOpened) {
						completeCut(leftCrossY, rightCrossY);
					}
				}

				lastDrawPoint = { x: canvasX, y: canvasY };
				cutTexture.needsUpdate = true;
			}
		}
	}

	function onMouseDown(event: MouseEvent): void {
		if (event.button !== 0) return; // Only left click

		// Start cutting if booster pack is selected
		if (selectedBoosterPack && !isPackOpened) {
			isCutting = true;
			lastDrawPoint = null;
			createCutPlane();

			// Clear previous drawing when starting a new stroke
			if (cutCanvasCtx && cutCanvas) {
				cutCanvasCtx.clearRect(0, 0, cutCanvas.width, cutCanvas.height);
				drawCutGuides(); // Redraw the blue guide lines
				if (cutTexture) {
					cutTexture.needsUpdate = true;
				}
				leftCrossY = null;
				rightCrossY = null;
			}
		}
	}

	function onMouseUp(event: MouseEvent): void {
		if (event.button !== 0) return;

		// Stop cutting
		if (isCutting) {
			isCutting = false;
			lastDrawPoint = null;
		}
	}

	// Cut guide line positions (in canvas coordinates)
	// The plane is 3x the pack size, so the pack occupies the middle third
	// Canvas is 512x512, pack edges are at 1/3 and 2/3 of the width
	const CUT_GUIDE_LEFT_X = Math.floor(512 / 3);   // ~170
	const CUT_GUIDE_RIGHT_X = Math.floor(512 * 2 / 3); // ~341

	function drawCutGuides(): void {
		if (!cutCanvasCtx || !cutCanvas) return;

		// Draw blue vertical guide lines on each side of the pack
		cutCanvasCtx.strokeStyle = '#4488ff';
		cutCanvasCtx.lineWidth = 3;
		cutCanvasCtx.setLineDash([10, 10]); // Dashed line

		// Left guide line
		cutCanvasCtx.beginPath();
		cutCanvasCtx.moveTo(CUT_GUIDE_LEFT_X, 0);
		cutCanvasCtx.lineTo(CUT_GUIDE_LEFT_X, cutCanvas.height);
		cutCanvasCtx.stroke();

		// Right guide line
		cutCanvasCtx.beginPath();
		cutCanvasCtx.moveTo(CUT_GUIDE_RIGHT_X, 0);
		cutCanvasCtx.lineTo(CUT_GUIDE_RIGHT_X, cutCanvas.height);
		cutCanvasCtx.stroke();

		// Reset line dash for red drawing
		cutCanvasCtx.setLineDash([]);
	}

	function createCutPlane(): void {
		if (!selectedBoosterPack || cutPlane) return;

		// Create canvas for drawing
		cutCanvas = document.createElement('canvas');
		cutCanvas.width = 512;
		cutCanvas.height = 512;
		cutCanvasCtx = cutCanvas.getContext('2d')!;

		// Transparent background
		cutCanvasCtx.clearRect(0, 0, 512, 512);

		// Draw the blue guide lines
		drawCutGuides();

		// Create texture from canvas
		cutTexture = new THREE.CanvasTexture(cutCanvas);
		cutTexture.needsUpdate = true;

		// Create a much larger plane so drawing can extend beyond the pack
		// Make it 3x the pack size so strokes can go well outside
		const planeWidth = 3.5 * 0.04 * 3;  // 0.42
		const planeHeight = 5.5 * 0.04 * 3; // 0.66

		const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
		const material = new THREE.MeshBasicMaterial({
			map: cutTexture,
			transparent: true,
			side: THREE.DoubleSide,
			depthTest: true,
			depthWrite: false
		});

		cutPlane = new THREE.Mesh(geometry, material);
		cutPlane.userData.isCutPlane = true; // Mark so we don't process it during split
		// Position slightly in front of the pack
		cutPlane.position.set(0, 0, 0.006);

		selectedBoosterPack.add(cutPlane);
	}

	function removeCutPlane(): void {
		if (cutPlane && selectedBoosterPack) {
			selectedBoosterPack.remove(cutPlane);
			cutPlane.geometry.dispose();
			(cutPlane.material as THREE.Material).dispose();
			cutPlane = null;
		}
		if (cutTexture) {
			cutTexture.dispose();
			cutTexture = null;
		}
		cutCanvas = null;
		cutCanvasCtx = null;
		lastDrawPoint = null;
	}

	function removePackParts(pack: THREE.Group): void {
		// Remove cloned top meshes
		const topMeshes = pack.userData.topMeshes as THREE.Mesh[] | undefined;
		if (topMeshes) {
			for (const mesh of topMeshes) {
				mesh.parent?.remove(mesh);
				mesh.geometry.dispose();
				if (Array.isArray(mesh.material)) {
					mesh.material.forEach((m) => m.dispose());
				} else {
					mesh.material.dispose();
				}
			}
			pack.userData.topMeshes = undefined;
		}

		// Restore bottom meshes (originals) - restore material and position
		const bottomMeshes = pack.userData.bottomMeshes as THREE.Mesh[] | undefined;
		const originalPositions = pack.userData.originalPositions as Map<THREE.Mesh, THREE.Vector3> | undefined;

		if (bottomMeshes) {
			for (const mesh of bottomMeshes) {
				// Dispose clipped material
				if (mesh.material) {
					if (Array.isArray(mesh.material)) {
						mesh.material.forEach((m) => m.dispose());
					} else {
						mesh.material.dispose();
					}
				}
				// Restore original material
				if (mesh.userData.originalMaterial) {
					mesh.material = mesh.userData.originalMaterial;
					mesh.userData.originalMaterial = undefined;
				}
				// Restore original position
				if (originalPositions) {
					const origPos = originalPositions.get(mesh);
					if (origPos) {
						mesh.position.copy(origPos);
					}
				}
				// Clear flags
				mesh.userData.isBottomPart = undefined;
			}
			pack.userData.bottomMeshes = undefined;
			pack.userData.originalPositions = undefined;
		}
	}

	function completeCut(leftY: number, rightY: number): void {
		if (!selectedBoosterPack) return;

		isPackOpened = true;
		isCutting = false;
		lastDrawPoint = null;

		// The drawing plane is 3x the pack size, centered on the pack
		// Plane dimensions in local space
		const planeHeight = 5.5 * 0.04 * 3; // 0.66
		const planeWidth = 3.5 * 0.04 * 3;  // 0.42

		// Convert canvas coordinates to local space
		// Canvas: 512x512, Y=0 at top, Y=512 at bottom
		// Local: Y+ is up, Y- is down
		const leftYLocal = (0.5 - leftY / 512) * planeHeight;
		const rightYLocal = (0.5 - rightY / 512) * planeHeight;

		// X positions of the blue guides in local space
		// Canvas X: left guide at 512/3, right guide at 512*2/3
		// Local X: ranges from -planeWidth/2 to +planeWidth/2
		const leftXLocal = (CUT_GUIDE_LEFT_X / 512 - 0.5) * planeWidth;
		const rightXLocal = (CUT_GUIDE_RIGHT_X / 512 - 0.5) * planeWidth;

		console.log('Cut line: left(', leftXLocal, leftYLocal, ') to right(', rightXLocal, rightYLocal, ')');

		// Split the booster pack along this angled line
		splitBoosterPack(leftXLocal, leftYLocal, rightXLocal, rightYLocal);
	}

	function splitBoosterPack(leftX: number, leftY: number, rightX: number, rightY: number): void {
		if (!selectedBoosterPack) return;

		// Enable clipping in renderer
		if (renderer) {
			renderer.localClippingEnabled = true;
		}

		// Calculate the cut line direction in local space (XY plane, Z=0)
		// Line goes from (leftX, leftY) to (rightX, rightY)
		// These coordinates are in booster pack local space (already scaled)
		const lineDir = new THREE.Vector2(rightX - leftX, rightY - leftY).normalize();

		// Normal to the cut line (perpendicular, pointing "up" relative to the line)
		// Rotate 90 degrees counter-clockwise: (x, y) -> (-y, x)
		const normal2D = new THREE.Vector2(-lineDir.y, lineDir.x);

		// Make sure normal points upward (positive Y component)
		if (normal2D.y < 0) {
			normal2D.negate();
		}

		// The cut plane normal in 3D
		const localNormal = new THREE.Vector3(normal2D.x, normal2D.y, 0).normalize();

		// Midpoint of the cut line in booster pack local space
		const midPoint = new THREE.Vector3(
			(leftX + rightX) / 2,
			(leftY + rightY) / 2,
			0
		);

		console.log('Cut: left(', leftX, leftY, ') right(', rightX, rightY, ') mid:', midPoint, 'normal:', localNormal);

		// Find the model group inside the booster pack (it has the 0.04 scale)
		let modelGroup: THREE.Object3D | null = null;
		selectedBoosterPack.children.forEach((child) => {
			if (child.scale.x === 0.04) {
				modelGroup = child;
			}
		});

		if (!modelGroup) {
			console.error('Could not find model group');
			return;
		}

		// Transform the midpoint from booster pack local space to world space
		// The midpoint is in booster pack coordinates, need to go through model's transform
		const worldMidPoint = midPoint.clone();
		selectedBoosterPack.localToWorld(worldMidPoint);

		// Transform the normal to world space
		const normalMatrix = new THREE.Matrix3().getNormalMatrix(selectedBoosterPack.matrixWorld);
		const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

		// Calculate plane constant in world space
		const worldConstant = -worldNormal.dot(worldMidPoint);

		console.log('World cut - midPoint:', worldMidPoint, 'normal:', worldNormal, 'constant:', worldConstant);

		// Create clipping planes in world space
		// cutPlaneForTop: shows geometry ABOVE the cut (clips below)
		// cutPlaneForBottom: shows geometry BELOW the cut (clips above)
		const cutPlaneForTop = new THREE.Plane(worldNormal.clone(), worldConstant);
		const cutPlaneForBottom = new THREE.Plane(worldNormal.clone().negate(), -worldConstant);

		// Store clipping data and original positions for animation
		const topMeshes: THREE.Mesh[] = [];
		const bottomMeshes: THREE.Mesh[] = [];
		const originalPositions: Map<THREE.Mesh, THREE.Vector3> = new Map();

		// Collect meshes to process (avoid modifying during traverse)
		const meshesToProcess: THREE.Mesh[] = [];
		selectedBoosterPack.traverse((child) => {
			if (child instanceof THREE.Mesh && !child.userData.isCutPlane) {
				meshesToProcess.push(child);
				// Log mesh info for debugging
				const worldPos = new THREE.Vector3();
				child.getWorldPosition(worldPos);

				// Get bounding box in world space
				const bbox = new THREE.Box3().setFromObject(child);

				// Test if clipping plane would cut through this mesh
				const distToPlane = cutPlaneForTop.distanceToPoint(worldPos);
				console.log('Mesh:', child.name,
					'center Y:', worldPos.y.toFixed(3),
					'bbox Y:', bbox.min.y.toFixed(3), 'to', bbox.max.y.toFixed(3),
					'dist:', distToPlane.toFixed(3));
			}
		});

		console.log('Total meshes:', meshesToProcess.length);
		console.log('Cut plane Y (world midpoint):', worldMidPoint.y.toFixed(3));

		// For each mesh, create a clone - one shows top half, original shows bottom half
		for (const mesh of meshesToProcess) {
			// Store original position
			originalPositions.set(mesh, mesh.position.clone());

			// Original mesh becomes bottom part
			mesh.userData.isBottomPart = true;
			mesh.userData.originalMaterial = mesh.material;

			// Create a NEW material with clipping for the bottom part
			const oldMat = mesh.material as THREE.Material;
			let bottomMat: THREE.Material;

			if (oldMat.type === 'MeshStandardMaterial') {
				const oldStd = oldMat as THREE.MeshStandardMaterial;
				bottomMat = new THREE.MeshStandardMaterial({
					color: oldStd.color,
					map: oldStd.map,
					metalness: oldStd.metalness,
					roughness: oldStd.roughness,
					side: THREE.DoubleSide,
					clippingPlanes: [cutPlaneForBottom],
					clipShadows: true
				});
			} else {
				const oldBasic = oldMat as THREE.MeshBasicMaterial;
				bottomMat = new THREE.MeshBasicMaterial({
					color: oldBasic.color,
					map: oldBasic.map,
					transparent: oldBasic.transparent,
					side: THREE.DoubleSide,
					clippingPlanes: [cutPlaneForBottom],
					clipShadows: true
				});
			}
			mesh.material = bottomMat;
			bottomMeshes.push(mesh);

			// Clone becomes top part (add to same parent to keep in same space)
			const topClone = mesh.clone(false); // Don't deep clone
			topClone.userData.isTopPart = true;
			topClone.userData.originalPosition = mesh.position.clone();

			// Create a NEW material with clipping for the top part
			let topMat: THREE.Material;
			if (oldMat.type === 'MeshStandardMaterial') {
				const oldStd = oldMat as THREE.MeshStandardMaterial;
				topMat = new THREE.MeshStandardMaterial({
					color: oldStd.color,
					map: oldStd.map,
					metalness: oldStd.metalness,
					roughness: oldStd.roughness,
					side: THREE.DoubleSide,
					clippingPlanes: [cutPlaneForTop],
					clipShadows: true
				});
			} else {
				const oldBasic = oldMat as THREE.MeshBasicMaterial;
				topMat = new THREE.MeshBasicMaterial({
					color: oldBasic.color,
					map: oldBasic.map,
					transparent: oldBasic.transparent,
					side: THREE.DoubleSide,
					clippingPlanes: [cutPlaneForTop],
					clipShadows: true
				});
			}
			topClone.material = topMat;

			// Add clone as sibling (same parent as original)
			mesh.parent?.add(topClone);
			topMeshes.push(topClone);

			console.log('Applied clipping to', mesh.name || 'unnamed', '- bottom planes:', (mesh.material as any).clippingPlanes?.length, 'top planes:', (topClone.material as any).clippingPlanes?.length);
		}

		// Store references for cleanup and for updating clipping planes each frame
		selectedBoosterPack.userData.topMeshes = topMeshes;
		selectedBoosterPack.userData.bottomMeshes = bottomMeshes;
		selectedBoosterPack.userData.originalPositions = originalPositions;
		selectedBoosterPack.userData.cutPlaneForTop = cutPlaneForTop;
		selectedBoosterPack.userData.cutPlaneForBottom = cutPlaneForBottom;
		selectedBoosterPack.userData.localCutNormal = localNormal.clone();
		selectedBoosterPack.userData.localCutPoint = midPoint.clone();
		selectedBoosterPack.userData.modelGroup = modelGroup;

		console.log('Split complete. Top meshes:', topMeshes.length, 'Bottom meshes:', bottomMeshes.length);

		// Animate meshes separating along the cut normal
		animatePackOpen(localNormal, topMeshes, bottomMeshes);
	}

	// Call this in the render loop to update clipping planes as the pack moves
	function updateBoosterPackClipping(): void {
		if (!selectedBoosterPack || !isPackOpened) return;

		const cutPlaneForTop = selectedBoosterPack.userData.cutPlaneForTop as THREE.Plane | undefined;
		const cutPlaneForBottom = selectedBoosterPack.userData.cutPlaneForBottom as THREE.Plane | undefined;
		const localNormal = selectedBoosterPack.userData.localCutNormal as THREE.Vector3 | undefined;
		const localPoint = selectedBoosterPack.userData.localCutPoint as THREE.Vector3 | undefined;
		const modelGroup = selectedBoosterPack.userData.modelGroup as THREE.Object3D | undefined;

		if (!cutPlaneForTop || !cutPlaneForBottom || !localNormal || !localPoint || !modelGroup) return;

		// Transform local cut plane to world space using the MODEL GROUP's transform
		// (not the booster pack, because the meshes are children of the model group)
		const worldPoint = localPoint.clone();
		// First transform from booster pack local to model local (account for model's scale)
		// The model has scale 0.04, so model local coords = booster local / 0.04
		// But localToWorld will handle this if we use the model group
		selectedBoosterPack.localToWorld(worldPoint);

		const normalMatrix = new THREE.Matrix3().getNormalMatrix(selectedBoosterPack.matrixWorld);
		const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

		const worldConstant = -worldNormal.dot(worldPoint);

		// Update the clipping planes
		cutPlaneForTop.normal.copy(worldNormal);
		cutPlaneForTop.constant = worldConstant;

		cutPlaneForBottom.normal.copy(worldNormal).negate();
		cutPlaneForBottom.constant = -worldConstant;
	}

	function animatePackOpen(cutNormal: THREE.Vector3, topMeshes: THREE.Mesh[], bottomMeshes: THREE.Mesh[]): void {
		// Move meshes slightly along the cut normal direction
		const moveDistance = 0.02; // Small separation

		// Calculate target offsets (in local space of the booster pack)
		const topOffset = cutNormal.clone().multiplyScalar(moveDistance);
		const bottomOffset = cutNormal.clone().multiplyScalar(-moveDistance);

		// Store original positions and calculate targets
		const topTargets: Map<THREE.Mesh, THREE.Vector3> = new Map();
		const bottomTargets: Map<THREE.Mesh, THREE.Vector3> = new Map();

		for (const mesh of topMeshes) {
			topTargets.set(mesh, mesh.position.clone().add(topOffset));
		}
		for (const mesh of bottomMeshes) {
			bottomTargets.set(mesh, mesh.position.clone().add(bottomOffset));
		}

		function animate() {
			let totalDiff = 0;

			// Animate top meshes
			for (const mesh of topMeshes) {
				const target = topTargets.get(mesh)!;
				const diff = target.clone().sub(mesh.position);
				totalDiff += diff.length();
				mesh.position.add(diff.multiplyScalar(0.15));
			}

			// Animate bottom meshes
			for (const mesh of bottomMeshes) {
				const target = bottomTargets.get(mesh)!;
				const diff = target.clone().sub(mesh.position);
				totalDiff += diff.length();
				mesh.position.add(diff.multiplyScalar(0.15));
			}

			if (totalDiff > 0.0001) {
				requestAnimationFrame(animate);
			}
		}

		animate();
	}

	function onKeyDown(event: KeyboardEvent): void {
		const key = event.key.toLowerCase();

		// Escape deselects booster pack
		if (key === 'escape' && selectedBoosterPack) {
			deselectBoosterPack(selectedBoosterPack);
			return;
		}

		// Spacebar toggles edit mode
		if (event.code === 'Space') {
			event.preventDefault();
			toggleEditMode();
			return;
		}

		// Edit mode controls for selected object
		if (isEditMode && selectedEditObject) {
			// Arrow keys move the object
			if (key === 'arrowup') {
				event.preventDefault();
				moveEditObject(0, 1); // Forward
				return;
			} else if (key === 'arrowdown') {
				event.preventDefault();
				moveEditObject(0, -1); // Backward
				return;
			} else if (key === 'arrowleft') {
				event.preventDefault();
				moveEditObject(-1, 0); // Left
				return;
			} else if (key === 'arrowright') {
				event.preventDefault();
				moveEditObject(1, 0); // Right
				return;
			}
			// Q/E rotate the object
			else if (key === 'q') {
				event.preventDefault();
				rotateEditObject(1); // Rotate left (counter-clockwise)
				return;
			} else if (key === 'e') {
				event.preventDefault();
				rotateEditObject(-1); // Rotate right (clockwise)
				return;
			}
			// Escape deselects
			else if (key === 'escape') {
				event.preventDefault();
				deselectEditObject();
				return;
			}
		}

		// When book is open, A/D and arrow keys control page flipping instead of movement
		if (isBookOpen) {
			if (key === 'a' || key === 'arrowleft') {
				event.preventDefault();
				flipPageLeft();
				return;
			} else if (key === 'd' || key === 'arrowright') {
				event.preventDefault();
				flipPageRight();
				return;
			}
		}

		keysPressed.add(key);

		// Book action shortcuts when a book is selected
		if (selectedBook) {
			if (key === 'z') {
				if (isBookOpen) {
					handleCloseBook();
				} else {
					handleOpenBook();
				}
			} else if (key === 'x') {
				handlePutBack();
			} else if (key === 'c') {
				handlePutAway();
			}
		}
	}

	function flipPageLeft(): void {
		// Go back to previous spread (e.g., from page 3 to page 1)
		if (currentPage <= 1 || !selectedBook) return;

		const userData = selectedBook.userData;
		if (userData.isFlipping) return;

		// Save the page number that will be shown on the flipping page (the even number being flipped back)
		const flippingPageNum = currentPage - 1;

		// Calculate target page but DON'T update currentPage yet - wait for animation to complete
		const targetPage = currentPage - 2 < 1 ? 1 : currentPage - 2;
		userData.targetPage = targetPage;

		// Start flip animation: a page flips from left back to right
		startFlipAnimation(selectedBook, 1, flippingPageNum);
	}

	function flipPageRight(): void {
		// Go forward to next spread (e.g., from page 1 to page 3)
		if (currentPage >= TOTAL_PAGES - 1 || !selectedBook) return;

		const userData = selectedBook.userData;
		if (userData.isFlipping) return;

		// Save the page number that will be shown on the flipping page (the odd number being flipped)
		const flippingPageNum = currentPage;

		// Calculate target page but DON'T update currentPage yet - wait for animation to complete
		const targetPage = currentPage + 2 > TOTAL_PAGES ? TOTAL_PAGES : currentPage + 2;
		userData.targetPage = targetPage;

		// Start flip animation: a page flips from right to left
		startFlipAnimation(selectedBook, -1, flippingPageNum);
	}

	function startFlipAnimation(book: THREE.Group, direction: number, pageNum: number): void {
		const userData = book.userData;

		const flippingPageFront = userData.flippingPageFront as THREE.Mesh;
		const flippingPageBack = userData.flippingPageBack as THREE.Mesh;
		const flippingPivot = userData.flippingPagePivot as THREE.Group;
		const flippingFrontMaterial = userData.flippingPageFrontMaterial as THREE.MeshStandardMaterial;
		const flippingBackMaterial = userData.flippingPageBackMaterial as THREE.MeshStandardMaterial;
		const rightPageMaterial = userData.rightPageMaterial as THREE.MeshStandardMaterial;

		if (direction < 0) {
			// Flipping right to left (going forward): page with odd number flips to reveal even+odd underneath
			// The left page stays as-is during the flip (shows current even page)
			// The right page shows the DESTINATION right page underneath the flipping page
			const targetPage = userData.targetPage;
			const newRightPageNum = targetPage;

			// Pre-render the destination RIGHT page (will be revealed as flip completes)
			if (newRightPageNum >= 1 && newRightPageNum <= TOTAL_PAGES) {
				rightPageMaterial.map = createNumberedPageTexture(newRightPageNum, false);
				rightPageMaterial.needsUpdate = true;
				(userData.rightPage as THREE.Mesh).visible = true;
			}

			// LEFT page keeps showing current content - don't change it during flip

			// The flipping page: front shows current right page (odd), back shows next even page
			// When flipping from page 1 to page 3: front=1, back=2
			flippingFrontMaterial.map = createNumberedPageTexture(pageNum, false);
			flippingFrontMaterial.needsUpdate = true;
			flippingBackMaterial.map = createNumberedPageTexture(pageNum + 1, true);
			flippingBackMaterial.needsUpdate = true;

			// Start at 0, go to -PI
			flippingPivot.rotation.y = 0;
			userData.targetFlipRotation = -Math.PI;

		} else {
			// Flipping left to right (going backward): page flips from left position to right position
			// Example: from page 3 to page 1
			// - Flipping page starts on LEFT showing current even (2) on its back
			// - Flipping page ends on RIGHT showing destination odd (1) on its front
			// - Static LEFT page underneath shows destination left (hidden for page 1)
			// - Static RIGHT page is HIDDEN during flip (flipping page lands on it)
			const targetPage = userData.targetPage;
			const leftPageMaterial = userData.leftPageMaterial as THREE.MeshStandardMaterial;

			// HIDE the static right page - the flipping page will land on this position
			(userData.rightPage as THREE.Mesh).visible = false;

			// Pre-render the destination LEFT page UNDERNEATH the flipping page
			const newLeftPageNum = targetPage - 1;
			if (newLeftPageNum >= 1 && newLeftPageNum <= TOTAL_PAGES) {
				leftPageMaterial.map = createNumberedPageTexture(newLeftPageNum, true);
				leftPageMaterial.needsUpdate = true;
				(userData.leftPage as THREE.Mesh).visible = true;
			} else {
				// Going back to page 1 means no left page
				(userData.leftPage as THREE.Mesh).visible = false;
			}

			// The flipping page:
			// Back shows the current even page (e.g., 2) - faces player at start
			// Front shows the destination right page (e.g., 1) - faces player at end
			flippingBackMaterial.map = createNumberedPageTexture(pageNum, true);
			flippingBackMaterial.needsUpdate = true;
			flippingFrontMaterial.map = createNumberedPageTexture(targetPage, false);
			flippingFrontMaterial.needsUpdate = true;

			// Start at -PI (left position), go to 0 (right position)
			flippingPivot.rotation.y = -Math.PI;
			userData.targetFlipRotation = 0;
		}

		flippingPageFront.visible = true;
		flippingPageBack.visible = true;
		userData.isFlipping = true;
		userData.flipDirection = direction;
	}

	function updatePageTextures(book: THREE.Group): void {
		const userData = book.userData;

		// currentPage represents which "spread" we're on
		// Spread 1: right=1, left=none (inside cover)
		// Spread 2: right=3, left=2
		// Spread 3: right=5, left=4
		// etc.
		// So rightPageNum = currentPage * 2 - 1, leftPageNum = currentPage * 2 - 2

		// Actually, let's keep it simple: currentPage is the right-hand page number (1, 3, 5, 7, 9)
		// Left page = currentPage - 1 (0, 2, 4, 6, 8) - page 0 means no left page
		const rightPageNum = currentPage;
		const leftPageNum = currentPage - 1;

		// Update right page texture
		const rightPageMaterial = userData.rightPageMaterial as THREE.MeshStandardMaterial;
		if (rightPageNum >= 1 && rightPageNum <= TOTAL_PAGES) {
			rightPageMaterial.map = createNumberedPageTexture(rightPageNum, false);
			rightPageMaterial.needsUpdate = true;
			(userData.rightPage as THREE.Mesh).visible = true;
		} else {
			(userData.rightPage as THREE.Mesh).visible = false;
		}

		// Update left page texture (page 0 means inside cover, so hide it)
		const leftPageMaterial = userData.leftPageMaterial as THREE.MeshStandardMaterial;
		if (leftPageNum >= 1 && leftPageNum <= TOTAL_PAGES) {
			leftPageMaterial.map = createNumberedPageTexture(leftPageNum, true);
			leftPageMaterial.needsUpdate = true;
			(userData.leftPage as THREE.Mesh).visible = true;
		} else {
			(userData.leftPage as THREE.Mesh).visible = false;
		}
	}

	function onKeyUp(event: KeyboardEvent): void {
		keysPressed.delete(event.key.toLowerCase());
	}

	function updateMovement(): void {
		if (!camera) return;

		// Calculate movement direction based on camera yaw
		const forward = new THREE.Vector3(0, 0, -1);
		const right = new THREE.Vector3(1, 0, 0);

		// Only rotate by yaw for movement (ignore pitch)
		const yawQuat = new THREE.Quaternion();
		yawQuat.setFromEuler(new THREE.Euler(0, yaw, 0));
		forward.applyQuaternion(yawQuat);
		right.applyQuaternion(yawQuat);

		let moveX = 0;
		let moveZ = 0;

		if (keysPressed.has('w')) {
			moveX += forward.x;
			moveZ += forward.z;
		}
		if (keysPressed.has('s')) {
			moveX -= forward.x;
			moveZ -= forward.z;
		}
		if (keysPressed.has('a')) {
			moveX -= right.x;
			moveZ -= right.z;
		}
		if (keysPressed.has('d')) {
			moveX += right.x;
			moveZ += right.z;
		}

		// Normalize and apply speed
		if (moveX !== 0 || moveZ !== 0) {
			const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
			moveX = (moveX / length) * MOVE_SPEED;
			moveZ = (moveZ / length) * MOVE_SPEED;

			// Apply movement with bounds checking
			const newX = camera.position.x + moveX;
			const newZ = camera.position.z + moveZ;

			camera.position.x = Math.max(ROOM_BOUNDS.minX, Math.min(ROOM_BOUNDS.maxX, newX));
			camera.position.z = Math.max(ROOM_BOUNDS.minZ, Math.min(ROOM_BOUNDS.maxZ, newZ));
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

	// Position in camera space for selected book
	// In camera local space: -Z is forward (where camera looks), +Z is toward the player's eyes
	// Y is up/down in camera space, X is left/right
	const BOOK_CAMERA_OFFSET = new THREE.Vector3(0, -0.2, -0.7); // In front of camera, slightly below center
	// When open, shift book RIGHT so the spine/back stay in place and pages are centered in view
	const BOOK_CAMERA_OFFSET_OPEN = new THREE.Vector3(BOOK_WIDTH / 2, 0, -0.5); // Shifted right by half page width

	function attachBookToCamera(book: THREE.Group): void {
		if (!book || !camera) return;

		// DON'T remove from scene - keep book in scene but update its position each frame
		// to follow the camera. This avoids issues with camera children not rendering properly.
		book.userData.isAttachedToCamera = true;
		book.userData.targetPosition.copy(BOOK_CAMERA_OFFSET);
		book.userData.selectedPosition.copy(BOOK_CAMERA_OFFSET);
		// Initialize current offset to target for smooth start
		book.userData.currentCameraOffset.copy(BOOK_CAMERA_OFFSET);
	}

	function detachBookFromCamera(book: THREE.Group): void {
		if (!book || !book.userData.isAttachedToCamera) return;

		// Simply mark as not attached - the book is still in the scene
		book.userData.isAttachedToCamera = false;
	}

	function updateSelectedBookPosition(): void {
		if (!selectedBook || !camera) return;

		const userData = selectedBook.userData;

		// If attached to camera, position is in camera local space
		if (userData.isAttachedToCamera) {
			// When attached, the book is a child of the camera
			// so we set position in local (camera) space
			if (isBookOpen) {
				userData.targetPosition.copy(BOOK_CAMERA_OFFSET_OPEN);
			} else {
				userData.targetPosition.copy(BOOK_CAMERA_OFFSET);
			}
			// No need to update rotation - it's fixed relative to camera
			return;
		}

		// Fallback for non-attached books (shouldn't happen normally)
		const forward = new THREE.Vector3(0, 0, -1);
		forward.applyQuaternion(camera.quaternion);
		const basePos = camera.position.clone().add(forward.multiplyScalar(0.6));
		basePos.y = camera.position.y - 0.2;
		userData.selectedPosition.copy(basePos);

		if (isBookOpen) {
			const right = new THREE.Vector3(1, 0, 0);
			right.applyQuaternion(camera.quaternion);
			basePos.add(right.multiplyScalar(BOOK_WIDTH * 0.5));
		}

		userData.targetPosition.copy(basePos);
		userData.targetRotation.set(-0.35, yaw, 0);
	}

	function animate(): void {
		animationId = requestAnimationFrame(animate);

		// Update player movement
		updateMovement();

		// Keep selected book in front of player
		updateSelectedBookPosition();

		// Animate book position/rotation
		for (const book of albumBooks) {
			const userData = book.userData;

			// For camera-attached books, keep fixed in screen space
			if (userData.isAttachedToCamera) {
				// Animate the camera offset smoothly
				const offsetDiff = userData.targetPosition.clone().sub(userData.currentCameraOffset);
				if (offsetDiff.length() > 0.001) {
					userData.currentCameraOffset.add(offsetDiff.multiplyScalar(ANIMATION_SPEED));
				} else {
					userData.currentCameraOffset.copy(userData.targetPosition);
				}

				// Get camera's local axes
				const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
				const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
				const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

				// Get animated offset values
				const offsetX = userData.currentCameraOffset.x;
				const offsetY = userData.currentCameraOffset.y;
				const offsetZ = userData.currentCameraOffset.z;

				// Position book in front of camera
				const worldPos = camera.position.clone()
					.add(forward.multiplyScalar(-offsetZ))
					.add(right.multiplyScalar(offsetX))
					.add(up.multiplyScalar(offsetY));

				book.position.copy(worldPos);

				// Keep book at fixed rotation facing the camera
				// Copy camera quaternion so book stays fixed in view
				book.quaternion.copy(camera.quaternion);
				// Only tilt when closed, flat when open
				if (!isBookOpen) {
					book.rotateX(-0.3); // Slight tilt - top away from player
				}
			} else {
				// Animate position for non-attached books
				const posDiff = userData.targetPosition.clone().sub(book.position);
				if (posDiff.length() > 0.001) {
					book.position.add(posDiff.multiplyScalar(ANIMATION_SPEED));
					userData.isAnimating = true;
				} else {
					book.position.copy(userData.targetPosition);
				}
			}

			// Animate rotation only for non-camera-attached books
			if (!userData.isAttachedToCamera) {
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

			// Animate cover opening/closing
			const frontCoverPivot = userData.frontCoverPivot as THREE.Group;
			if (frontCoverPivot) {
				const coverDiff = userData.targetCoverRotation - frontCoverPivot.rotation.y;
				if (Math.abs(coverDiff) > 0.001) {
					frontCoverPivot.rotation.y += coverDiff * ANIMATION_SPEED;
				} else {
					frontCoverPivot.rotation.y = userData.targetCoverRotation;
				}
			}

			// Animate page flipping
			if (userData.isFlipping && userData.flippingPagePivot) {
				const flipPivot = userData.flippingPagePivot as THREE.Group;
				const targetRot = userData.targetFlipRotation;
				const flipDiff = targetRot - flipPivot.rotation.y;

				if (Math.abs(flipDiff) > 0.01) {
					flipPivot.rotation.y += flipDiff * ANIMATION_SPEED * 2;
				} else {
					flipPivot.rotation.y = targetRot;
					// Animation complete
					const wasFlippingBackward = userData.flipDirection > 0;
					userData.isFlipping = false;
					userData.flippingPageFront.visible = false;
					userData.flippingPageBack.visible = false;

					// Now update currentPage to the target
					if (userData.targetPage !== undefined) {
						currentPage = userData.targetPage;

						// Update static pages to show final content
						const leftPageMaterial = userData.leftPageMaterial as THREE.MeshStandardMaterial;
						const rightPageMaterial = userData.rightPageMaterial as THREE.MeshStandardMaterial;
						const newLeftPageNum = currentPage - 1;
						const newRightPageNum = currentPage;

						// Update left page
						if (newLeftPageNum >= 1 && newLeftPageNum <= TOTAL_PAGES) {
							leftPageMaterial.map = createNumberedPageTexture(newLeftPageNum, true);
							leftPageMaterial.needsUpdate = true;
							(userData.leftPage as THREE.Mesh).visible = true;
						} else {
							(userData.leftPage as THREE.Mesh).visible = false;
						}

						// Update right page (especially important after backward flip)
						if (wasFlippingBackward) {
							rightPageMaterial.map = createNumberedPageTexture(newRightPageNum, false);
							rightPageMaterial.needsUpdate = true;
							(userData.rightPage as THREE.Mesh).visible = true;
						}

						userData.targetPage = undefined;
					}
				}
			}
		}

		// Animate booster packs
		for (const pack of boosterPacks3D) {
			const userData = pack.userData;

			if (userData.isAttachedToCamera) {
				// Animate the camera offset smoothly
				const offsetDiff = userData.targetPosition.clone().sub(userData.currentCameraOffset);
				if (offsetDiff.length() > 0.001) {
					userData.currentCameraOffset.add(offsetDiff.multiplyScalar(ANIMATION_SPEED));
				} else {
					userData.currentCameraOffset.copy(userData.targetPosition);
				}

				// Get camera's local axes
				const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
				const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
				const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

				// Get animated offset values
				const offsetX = userData.currentCameraOffset.x;
				const offsetY = userData.currentCameraOffset.y;
				const offsetZ = userData.currentCameraOffset.z;

				// Position pack in front of camera
				const worldPos = camera.position.clone()
					.add(forward.multiplyScalar(-offsetZ))
					.add(right.multiplyScalar(offsetX))
					.add(up.multiplyScalar(offsetY));

				pack.position.copy(worldPos);

				// Keep pack facing the camera (parallel to view)
				pack.quaternion.copy(camera.quaternion);
			} else {
				// Animate position for non-attached packs
				const posDiff = userData.targetPosition.clone().sub(pack.position);
				if (posDiff.length() > 0.001) {
					pack.position.add(posDiff.multiplyScalar(ANIMATION_SPEED));
				} else {
					pack.position.copy(userData.targetPosition);
				}

				// Animate rotation
				const rotXDiff = userData.targetRotation.x - pack.rotation.x;
				const rotYDiff = userData.targetRotation.y - pack.rotation.y;
				const rotZDiff = userData.targetRotation.z - pack.rotation.z;

				if (Math.abs(rotXDiff) > 0.001 || Math.abs(rotYDiff) > 0.001 || Math.abs(rotZDiff) > 0.001) {
					pack.rotation.x += rotXDiff * ANIMATION_SPEED;
					pack.rotation.y += rotYDiff * ANIMATION_SPEED;
					pack.rotation.z += rotZDiff * ANIMATION_SPEED;
				} else {
					pack.rotation.copy(userData.targetRotation);
				}
			}
		}

		// Update cursor based on hover state
		if (container) {
			container.style.cursor = hoveredBook ? 'pointer' : 'crosshair';
		}

		// Update booster pack clipping planes (they need to track camera movement)
		updateBoosterPackClipping();

		renderer.render(scene, camera);
	}

	function selectBook(book: THREE.Group): void {
		const userData = book.userData;

		// If already selected, deselect it
		if (userData.isSelected) {
			deselectBook(book);
			return;
		}

		// Deselect any previously selected book or booster pack
		if (selectedBook && selectedBook !== book) {
			deselectBook(selectedBook);
		}
		if (selectedBoosterPack) {
			deselectBoosterPack(selectedBoosterPack);
		}

		// Mark as selected
		userData.isSelected = true;
		selectedBook = book;
		selectedAlbum = userData.album;

		// Attach book to camera so it moves with the player
		attachBookToCamera(book);
	}

	function deselectBook(book: THREE.Group): void {
		const userData = book.userData;

		userData.isSelected = false;
		if (selectedBook === book) {
			selectedBook = null;
			selectedAlbum = null;
		}

		// Close the book if open
		if (isBookOpen) {
			closeBook(book);
		}

		// Detach from camera first
		detachBookFromCamera(book);

		// Return to original position on desk
		userData.targetPosition.copy(userData.originalPosition);
		userData.targetRotation.copy(userData.originalRotation);
	}

	function openBook(book: THREE.Group): void {
		if (!book || isBookOpen) return;

		const userData = book.userData;

		// Reset to page 1 when opening a book
		currentPage = 1;

		// Set target rotation for smooth animation
		userData.targetCoverRotation = -Math.PI; // Open fully flat (180 degrees)

		// Shift the book to the right so the open book is centered
		// When open, the cover swings left, so we need to move right by about half the book width
		if (userData.isAttachedToCamera) {
			// For camera-attached books, use camera-local offset
			userData.targetPosition.copy(BOOK_CAMERA_OFFSET_OPEN);
		} else {
			const right = new THREE.Vector3(1, 0, 0);
			right.applyQuaternion(camera.quaternion);
			const shiftAmount = BOOK_WIDTH * 0.5;
			userData.targetPosition.copy(userData.selectedPosition).add(right.multiplyScalar(shiftAmount));
		}

		// Show the page surfaces and update their textures
		updatePageTextures(book);

		isBookOpen = true;
	}

	function closeBook(book: THREE.Group): void {
		if (!book || !isBookOpen) return;

		const userData = book.userData;

		// Set target rotation for smooth animation
		userData.targetCoverRotation = 0; // Close the cover

		// Hide page surfaces
		(userData.leftPage as THREE.Mesh).visible = false;
		(userData.rightPage as THREE.Mesh).visible = false;
		(userData.flippingPageFront as THREE.Mesh).visible = false;
		(userData.flippingPageBack as THREE.Mesh).visible = false;

		// Return to the centered selected position
		if (userData.isAttachedToCamera) {
			// For camera-attached books, use camera-local offset
			userData.targetPosition.copy(BOOK_CAMERA_OFFSET);
		} else {
			userData.targetPosition.copy(userData.selectedPosition);
		}

		isBookOpen = false;
	}

	function handleOpenBook(): void {
		if (selectedBook) {
			openBook(selectedBook);
		}
	}

	function handleCloseBook(): void {
		if (selectedBook) {
			closeBook(selectedBook);
		}
	}

	function handlePutBack(): void {
		if (selectedBook) {
			deselectBook(selectedBook);
		}
	}

	function handlePutAway(): void {
		if (!selectedBook || nextShelfSlot >= SHELF_MAX_BOOKS) return;

		const book = selectedBook;
		const userData = book.userData;

		// Close the book if open
		if (isBookOpen) {
			closeBook(book);
		}

		// Detach from camera first
		detachBookFromCamera(book);

		// Deselect but don't return to desk
		userData.isSelected = false;
		selectedBook = null;
		selectedAlbum = null;

		// Calculate shelf position for this book
		// Books stand vertically on the shelf, spine facing out
		const shelfStartX = -0.75; // Start from left side of shelf
		const targetX = shelfStartX + nextShelfSlot * SHELF_BOOK_SPACING;
		const targetY = SHELF_Y + BOOK_HEIGHT / 2 + 0.02; // On top of shelf surface
		const targetZ = SHELF_Z + 0.05; // Slightly forward from back

		// Set target position on shelf
		userData.targetPosition.set(targetX, targetY, targetZ);

		// Rotate to stand upright with spine facing the player
		// Book stands upright (no X rotation), rotated 90 degrees so spine faces out
		userData.targetRotation.set(0, Math.PI / 2, 0);

		// Update original position to shelf position (so it stays there)
		userData.originalPosition.copy(userData.targetPosition);
		userData.originalRotation.copy(userData.targetRotation);

		// Track this book as being on the shelf
		shelfBooks.push(book);
		nextShelfSlot++;
	}

	function onBookClick(event: MouseEvent): void {
		// Only handle left-click
		if (event.button !== 0) return;

		// Block all click interactions when a booster pack is selected
		if (selectedBoosterPack) return;

		if (!container || !camera) return;

		const rect = container.getBoundingClientRect();

		// Calculate NDC from click position
		const clickX = (event.clientX - rect.left) / rect.width;
		const clickY = (event.clientY - rect.top) / rect.height;
		const ndcX = clickX * 2 - 1;
		const ndcY = -(clickY * 2 - 1);

		// Raycast from the actual click position in NDC
		raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

		// In edit mode, check for editable objects first
		if (isEditMode) {
			const allIntersects = raycaster.intersectObjects(scene.children, true);
			const editableObj = getEditableObjectFromIntersection(allIntersects);

			if (editableObj) {
				selectEditObject(editableObj);
				return;
			} else if (selectedEditObject) {
				// Clicked on empty space or non-editable, deselect
				deselectEditObject();
				return;
			}
		}

		// Normal mode: check for album books and booster packs
		const bookIntersects = raycaster.intersectObjects(albumBooks, true);
		const bookGroup = getBookFromIntersection(bookIntersects);

		const packIntersects = raycaster.intersectObjects(boosterPacks3D, true);
		const packGroup = getBoosterPackFromIntersection(packIntersects);

		if (bookGroup) {
			// Deselect booster pack if one is selected
			if (selectedBoosterPack) {
				deselectBoosterPack(selectedBoosterPack);
			}
			selectBook(bookGroup);
		} else if (packGroup) {
			// Deselect book if one is selected
			if (selectedBook) {
				deselectBook(selectedBook);
			}
			selectBoosterPack(packGroup);
		} else {
			// Clicked on empty space, deselect current selection
			if (selectedBook) {
				deselectBook(selectedBook);
			}
			if (selectedBoosterPack) {
				deselectBoosterPack(selectedBoosterPack);
			}
		}
	}

	function onResize(): void {
		if (!container || !camera || !renderer) return;

		camera.aspect = container.clientWidth / container.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(container.clientWidth, container.clientHeight);
	}

	function generateBoosterPackAlbums(albums: Album[]): Album[] {
		if (albums.length === 0) return [];

		// Generate 5 booster packs, each randomly assigned to an owned album
		const packs: Album[] = [];
		for (let i = 0; i < BOOSTER_PACK_COUNT; i++) {
			const randomIndex = Math.floor(Math.random() * albums.length);
			packs.push(albums[randomIndex]);
		}
		return packs;
	}

	async function loadOwnedAlbums(): Promise<void> {
		const allAlbums = await getAlbumCollection();
		const ownedAlbumIds = new Set(playerAlbumsService.all().map((o) => o.albumId));
		ownedAlbums = allAlbums.filter((album) => ownedAlbumIds.has(album.id));
		boosterPackAlbums = generateBoosterPackAlbums(ownedAlbums);
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
				await placeBoosterPacksInRoom();
			}
		});

		document.addEventListener('mousemove', onMouseMove);
		container.addEventListener('click', onBookClick);
		container.addEventListener('mousedown', onMouseDown);
		container.addEventListener('mouseup', onMouseUp);
		container.addEventListener('contextmenu', onContextMenu);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('resize', onResize);

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}

		document.removeEventListener('mousemove', onMouseMove);
		if (container) {
			container.removeEventListener('click', onBookClick);
			container.removeEventListener('mousedown', onMouseDown);
			container.removeEventListener('mouseup', onMouseUp);
			container.removeEventListener('contextmenu', onContextMenu);
		}
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
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

		// Cleanup booster packs
		boosterPacks3D.forEach((pack) => {
			pack.traverse((obj) => {
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

		// Cleanup booster pack base model
		if (boosterPackBaseModel) {
			boosterPackBaseModel.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.geometry.dispose();
					if (Array.isArray(obj.material)) {
						obj.material.forEach((m) => m.dispose());
					} else {
						obj.material.dispose();
					}
				}
			});
		}

		// Cleanup loaded furniture models
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
		loadedFurnitureModels.clear();

		if (renderer) {
			renderer.dispose();
		}
	});
</script>

<div class="flex flex-col h-full">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-2xl font-bold">
				{currentRoom?.name ?? 'Room'}
			</h1>
			<p class="text-sm text-base-content/60">
				{#if isLoading}
					Loading...
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
			<span class="badge badge-ghost">WASD</span> move ·
			<span class="badge badge-ghost">Mouse</span> look ·
			<span class="badge badge-ghost">Click</span> interact ·
			<span class="badge badge-ghost">Space</span> edit mode
		</div>
	</div>

	<div class="relative flex-1 min-h-[500px]">
		<div
			bind:this={container}
			class="absolute inset-0 rounded-lg overflow-hidden cursor-none"
			role="application"
			aria-label="3D Room View"
			tabindex="0"
		></div>

		<!-- Crosshair - follows mouse position exactly -->
		<div
			class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
			style="left: {mouseScreenX}px; top: {mouseScreenY}px;"
		>
			<div class="w-6 h-6 flex items-center justify-center">
				<div class="absolute w-4 h-0.5 bg-white/70"></div>
				<div class="absolute w-0.5 h-4 bg-white/70"></div>
			</div>
		</div>

		{#if isEditMode}
			<div class="absolute top-4 left-4 flex flex-col gap-2">
				<div class="badge badge-error badge-lg gap-2">
					<span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
					Edit Mode
				</div>
				{#if selectedEditObject}
					<div class="bg-base-300/90 backdrop-blur-sm rounded-lg p-3 text-sm">
						<div class="font-bold text-cyan-400 mb-2">
							{selectedEditObject.userData.name || 'Object'}
						</div>
						<div class="space-y-1 text-base-content/80">
							<div><span class="badge badge-xs">Arrow Keys</span> Move</div>
							<div><span class="badge badge-xs">Q / E</span> Rotate</div>
							<div><span class="badge badge-xs">Esc</span> Deselect</div>
						</div>
					</div>
				{:else}
					<div class="text-xs text-base-content/60 bg-base-300/70 rounded px-2 py-1">
						Click an object to select
					</div>
				{/if}
			</div>
		{/if}

		{#if selectedBoosterPack}
			<div class="absolute top-4 left-1/2 -translate-x-1/2 bg-base-300/90 backdrop-blur-sm px-4 py-3 rounded-lg text-center">
				<div class="font-bold text-lg mb-1">{selectedBoosterPack.userData.album.title}</div>
				{#if isPackOpened}
					<div class="text-success font-medium">Pack Opened!</div>
				{:else}
					<div class="text-sm text-base-content/70 mb-2">Draw a line across the blue guides to cut</div>
					<div class="flex gap-2 justify-center">
						<div class="flex items-center gap-1">
							<div class="w-3 h-3 rounded-full {leftCrossY !== null ? 'bg-green-500' : 'bg-blue-500'}"></div>
							<span class="text-xs">Left</span>
						</div>
						<div class="flex items-center gap-1">
							<div class="w-3 h-3 rounded-full {rightCrossY !== null ? 'bg-green-500' : 'bg-blue-500'}"></div>
							<span class="text-xs">Right</span>
						</div>
					</div>
				{/if}
			</div>
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2">
				<button class="btn btn-ghost btn-sm" onclick={() => deselectBoosterPack(selectedBoosterPack!)}>
					<span class="badge badge-xs mr-1">Esc</span> Put Back
				</button>
			</div>
		{:else if selectedAlbum}
			{#if isBookOpen}
				<!-- Page counter above the book -->
				<div class="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-base-300/80 backdrop-blur-sm px-4 py-2 rounded-lg">
					<button
						class="btn btn-circle btn-sm btn-ghost"
						onclick={flipPageLeft}
						disabled={currentPage <= 1}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<span class="text-lg font-medium min-w-[100px] text-center">
						{#if currentPage === 1}
							Page 1
						{:else}
							Pages {currentPage - 1}-{currentPage}
						{/if}
					</span>
					<button
						class="btn btn-circle btn-sm btn-ghost"
						onclick={flipPageRight}
						disabled={currentPage >= TOTAL_PAGES - 1}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
					<span class="text-xs text-base-content/60 ml-2">
						<span class="badge badge-xs">A/D</span> or <span class="badge badge-xs">←/→</span>
					</span>
				</div>
			{/if}
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
				{#if isBookOpen}
					<button class="btn btn-primary btn-sm" onclick={handleCloseBook}>
						<span class="badge badge-xs mr-1">Z</span> Close
					</button>
				{:else}
					<button class="btn btn-primary btn-sm" onclick={handleOpenBook}>
						<span class="badge badge-xs mr-1">Z</span> Open
					</button>
				{/if}
				<button class="btn btn-secondary btn-sm" onclick={handlePutBack}>
					<span class="badge badge-xs mr-1">X</span> Put Back
				</button>
				<button class="btn btn-ghost btn-sm" onclick={handlePutAway}>
					<span class="badge badge-xs mr-1">C</span> Put Away
				</button>
			</div>
		{/if}
	</div>
</div>
