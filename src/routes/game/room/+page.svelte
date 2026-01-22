<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
	const ROOM_BOUNDS = { minX: -3.5, maxX: 3.5, minZ: -4, maxZ: 4.5 };

	// Raycaster for book interaction
	let raycaster: THREE.Raycaster;
	let hoveredBook: THREE.Group | null = $state(null);
	let selectedAlbum: Album | null = $state(null);
	let selectedBook: THREE.Group | null = null;
	let isBookOpen = $state(false);

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

					// Scale and position the model next to the existing desk
					// Existing desk: 2.5 wide, 0.75 tall, 1.2 deep
					// GLTF models from Sketchfab are typically in cm, scale to match
					model.scale.set(1.5, 1.5, 1.5);
					model.position.set(2.8, 0, -4.4);

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

		// Desk position (desk is against the back wall at Z=-4.4)
		const deskX = 0;
		const deskZ = -4.4;
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
		// Position desk against the back wall (wall at Z=-5, desk depth 1.2, so center at -5 + 0.6 = -4.4)
		desk.position.set(0, 0, -4.4);
		scene.add(desk);

		// Add bookshelf on the wall above the desk
		const bookshelf = createBookshelf();
		bookshelf.position.set(0, SHELF_Y, -4.85); // Against the wall
		scene.add(bookshelf);

		// Load IKEA desk model next to the existing desk
		const ikeaDesk = await loadIkeaDesk();
		if (ikeaDesk) {
			scene.add(ikeaDesk);
		}

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

	// Mouse position for crosshair (in pixels relative to container)
	let mouseScreenX = $state(0);
	let mouseScreenY = $state(0);

	function onMouseMove(event: MouseEvent): void {
		if (!container || !camera) return;

		const rect = container.getBoundingClientRect();

		// Store pixel position for crosshair (relative to container)
		mouseScreenX = event.clientX - rect.left;
		mouseScreenY = event.clientY - rect.top;

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

	function onKeyDown(event: KeyboardEvent): void {
		const key = event.key.toLowerCase();

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

		// Update currentPage FIRST so startFlipAnimation can pre-render destination pages
		const newPage = currentPage - 2;
		currentPage = newPage < 1 ? 1 : newPage;

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

		// Update currentPage FIRST so startFlipAnimation can pre-render destination pages
		const newPage = currentPage + 2;
		currentPage = newPage > TOTAL_PAGES ? TOTAL_PAGES : newPage;

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

		// Pre-render the destination pages BEFORE starting the flip animation
		// so they're visible underneath the flipping page
		const rightPageMaterial = userData.rightPageMaterial as THREE.MeshStandardMaterial;
		const leftPageMaterial = userData.leftPageMaterial as THREE.MeshStandardMaterial;

		if (direction < 0) {
			// Flipping right to left (going forward): page with odd number flips to reveal even+odd underneath
			// currentPage has already been updated to the new value
			// Show the destination pages (new left and right) underneath
			const newRightPageNum = currentPage;
			const newLeftPageNum = currentPage - 1;

			// Update and show the destination right page (will be revealed as flip completes)
			if (newRightPageNum >= 1 && newRightPageNum <= TOTAL_PAGES) {
				rightPageMaterial.map = createNumberedPageTexture(newRightPageNum, false);
				rightPageMaterial.needsUpdate = true;
				(userData.rightPage as THREE.Mesh).visible = true;
			}

			// Update and show the destination left page
			if (newLeftPageNum >= 1 && newLeftPageNum <= TOTAL_PAGES) {
				leftPageMaterial.map = createNumberedPageTexture(newLeftPageNum, true);
				leftPageMaterial.needsUpdate = true;
				(userData.leftPage as THREE.Mesh).visible = true;
			}

			// The flipping page: front shows OLD right page (odd), back shows next even page
			// When flipping from page 1 to page 3: front=1, back=2
			flippingFrontMaterial.map = createNumberedPageTexture(pageNum, false);
			flippingFrontMaterial.needsUpdate = true;
			flippingBackMaterial.map = createNumberedPageTexture(pageNum + 1, true);
			flippingBackMaterial.needsUpdate = true;

			// Start at 0, go to -PI
			flippingPivot.rotation.y = 0;
			userData.targetFlipRotation = -Math.PI;

		} else {
			// Flipping left to right (going backward): page with even number flips back to reveal previous spread
			// currentPage has already been updated to the new value
			const newRightPageNum = currentPage;
			const newLeftPageNum = currentPage - 1;

			// Update and show the destination right page
			if (newRightPageNum >= 1 && newRightPageNum <= TOTAL_PAGES) {
				rightPageMaterial.map = createNumberedPageTexture(newRightPageNum, false);
				rightPageMaterial.needsUpdate = true;
				(userData.rightPage as THREE.Mesh).visible = true;
			}

			// Update and show the destination left page (or hide if going back to page 1)
			if (newLeftPageNum >= 1 && newLeftPageNum <= TOTAL_PAGES) {
				leftPageMaterial.map = createNumberedPageTexture(newLeftPageNum, true);
				leftPageMaterial.needsUpdate = true;
				(userData.leftPage as THREE.Mesh).visible = true;
			} else {
				(userData.leftPage as THREE.Mesh).visible = false;
			}

			// The flipping page: when going backward from page 3 to page 1
			// Back shows the even page (2), front shows the odd page before it (1)
			// But we're starting from left side (-PI), so back is facing player initially
			flippingBackMaterial.map = createNumberedPageTexture(pageNum, true);
			flippingBackMaterial.needsUpdate = true;
			flippingFrontMaterial.map = createNumberedPageTexture(pageNum - 1, false);
			flippingFrontMaterial.needsUpdate = true;

			// Start at -PI, go to 0
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
					// Animation complete - hide both sides of the flipping page
					// The destination pages were already pre-rendered before animation started
					userData.isFlipping = false;
					userData.flippingPageFront.visible = false;
					userData.flippingPageBack.visible = false;
				}
			}
		}

		// Update cursor based on hover state
		if (container) {
			container.style.cursor = hoveredBook ? 'pointer' : 'crosshair';
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

		if (!container || !camera) return;

		const rect = container.getBoundingClientRect();

		// Calculate NDC from click position
		const clickX = (event.clientX - rect.left) / rect.width;
		const clickY = (event.clientY - rect.top) / rect.height;
		const ndcX = clickX * 2 - 1;
		const ndcY = -(clickY * 2 - 1);

		// Raycast from the actual click position in NDC
		raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

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

		document.addEventListener('mousemove', onMouseMove);
		container.addEventListener('click', onBookClick);
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
			<span class="badge badge-ghost">WASD</span> move ·
			<span class="badge badge-ghost">Mouse</span> look ·
			<span class="badge badge-ghost">Click</span> interact
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

		{#if selectedAlbum}
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
