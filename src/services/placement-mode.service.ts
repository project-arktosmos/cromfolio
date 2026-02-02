/**
 * Placement Mode Service
 *
 * Manages stamp and icon placement mode state, including coordinate calculations
 * and scale management.
 */

import type { PlacementState, PlacementConfig } from '$types/game-state.type';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
	minScale: 0.2,
	maxScale: 2.0,
	scaleStep: 0.1,
	defaultScale: 1.0
};

// ============================================================================
// Coordinate Calculations
// ============================================================================

/**
 * Calculate placement position relative to a page element
 *
 * @param clientX - Mouse/touch X coordinate
 * @param clientY - Mouse/touch Y coordinate
 * @param pageRect - Bounding rect of the target page element
 * @returns Position as percentage (0-100) of page dimensions
 */
export function calculatePlacementPosition(
	clientX: number,
	clientY: number,
	pageRect: DOMRect
): { x: number; y: number } {
	// Calculate relative position within the page
	const relativeX = clientX - pageRect.left;
	const relativeY = clientY - pageRect.top;

	// Convert to percentage
	const x = (relativeX / pageRect.width) * 100;
	const y = (relativeY / pageRect.height) * 100;

	// Clamp to valid range
	return {
		x: Math.max(0, Math.min(100, x)),
		y: Math.max(0, Math.min(100, y))
	};
}

/**
 * Convert percentage position to pixel position
 *
 * @param percentX - X position as percentage (0-100)
 * @param percentY - Y position as percentage (0-100)
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 */
export function percentToPixels(
	percentX: number,
	percentY: number,
	containerWidth: number,
	containerHeight: number
): { x: number; y: number } {
	return {
		x: (percentX / 100) * containerWidth,
		y: (percentY / 100) * containerHeight
	};
}

/**
 * Convert pixel position to percentage
 */
export function pixelsToPercent(
	pixelX: number,
	pixelY: number,
	containerWidth: number,
	containerHeight: number
): { x: number; y: number } {
	return {
		x: (pixelX / containerWidth) * 100,
		y: (pixelY / containerHeight) * 100
	};
}

// ============================================================================
// Scale Management
// ============================================================================

/**
 * Adjust scale based on wheel delta or button press
 *
 * @param currentScale - Current scale value
 * @param delta - Change amount (positive = increase, negative = decrease)
 * @param config - Placement configuration
 */
export function adjustScale(
	currentScale: number,
	delta: number,
	config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG
): number {
	const newScale = currentScale + delta * config.scaleStep;
	return Math.max(config.minScale, Math.min(config.maxScale, newScale));
}

/**
 * Calculate scale from wheel event
 *
 * @param wheelDelta - Wheel event deltaY
 * @param currentScale - Current scale value
 * @param config - Placement configuration
 */
export function scaleFromWheelEvent(
	wheelDelta: number,
	currentScale: number,
	config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG
): number {
	// Normalize wheel delta (different browsers/devices have different values)
	const normalizedDelta = wheelDelta > 0 ? -1 : 1;
	return adjustScale(currentScale, normalizedDelta, config);
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Create initial placement state
 */
export function createInitialPlacementState(): PlacementState {
	return {
		isActive: false,
		scale: DEFAULT_PLACEMENT_CONFIG.defaultScale,
		position: { x: 50, y: 50 }, // Center
		itemType: 'stamp',
		itemId: null
	};
}

/**
 * Activate placement mode
 */
export function activatePlacement(
	state: PlacementState,
	itemType: 'stamp' | 'icon',
	itemId: string
): PlacementState {
	return {
		...state,
		isActive: true,
		itemType,
		itemId,
		scale: DEFAULT_PLACEMENT_CONFIG.defaultScale,
		position: { x: 50, y: 50 }
	};
}

/**
 * Deactivate placement mode
 */
export function deactivatePlacement(state: PlacementState): PlacementState {
	return {
		...state,
		isActive: false,
		itemId: null
	};
}

/**
 * Update position in placement state
 */
export function updatePosition(state: PlacementState, x: number, y: number): PlacementState {
	return {
		...state,
		position: { x, y }
	};
}

/**
 * Update scale in placement state
 */
export function updateScale(state: PlacementState, scale: number): PlacementState {
	return {
		...state,
		scale
	};
}

// ============================================================================
// Placement Mode Controller
// ============================================================================

export interface PlacementModeController {
	enter: (itemType: 'stamp' | 'icon', itemId: string) => void;
	exit: () => void;
	updatePosition: (clientX: number, clientY: number, pageRect: DOMRect) => void;
	adjustScale: (delta: number) => void;
	handleWheel: (deltaY: number) => void;
	getState: () => PlacementState;
	isActive: () => boolean;
}

/**
 * Create a placement mode controller
 *
 * @param config - Placement configuration
 * @param onStateChange - Callback when state changes
 */
export function createPlacementModeController(
	config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG,
	onStateChange: (state: PlacementState) => void
): PlacementModeController {
	let state = createInitialPlacementState();

	const notifyChange = () => {
		onStateChange({ ...state });
	};

	const enter = (itemType: 'stamp' | 'icon', itemId: string) => {
		state = activatePlacement(state, itemType, itemId);
		notifyChange();
	};

	const exit = () => {
		state = deactivatePlacement(state);
		notifyChange();
	};

	const updatePos = (clientX: number, clientY: number, pageRect: DOMRect) => {
		const pos = calculatePlacementPosition(clientX, clientY, pageRect);
		state = updatePosition(state, pos.x, pos.y);
		notifyChange();
	};

	const adjustScaleFn = (delta: number) => {
		const newScale = adjustScale(state.scale, delta, config);
		state = updateScale(state, newScale);
		notifyChange();
	};

	const handleWheel = (deltaY: number) => {
		const newScale = scaleFromWheelEvent(deltaY, state.scale, config);
		state = updateScale(state, newScale);
		notifyChange();
	};

	const getState = () => ({ ...state });

	const isActiveFn = () => state.isActive;

	return {
		enter,
		exit,
		updatePosition: updatePos,
		adjustScale: adjustScaleFn,
		handleWheel,
		getState,
		isActive: isActiveFn
	};
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/**
 * Handle keyboard events for placement mode
 *
 * @param event - Keyboard event
 * @param controller - Placement mode controller
 * @returns true if event was handled
 */
export function handlePlacementKeyboard(
	event: KeyboardEvent,
	controller: PlacementModeController
): boolean {
	if (!controller.isActive()) {
		return false;
	}

	switch (event.key) {
		case 'Escape':
			controller.exit();
			return true;

		case '+':
		case '=':
			controller.adjustScale(1);
			return true;

		case '-':
		case '_':
			controller.adjustScale(-1);
			return true;

		default:
			return false;
	}
}
