import { describe, it, expect, vi } from 'vitest';
import {
	calculatePlacementPosition,
	percentToPixels,
	pixelsToPercent,
	adjustScale,
	scaleFromWheelEvent,
	createInitialPlacementState,
	activatePlacement,
	deactivatePlacement,
	updatePosition,
	updateScale,
	createPlacementModeController,
	handlePlacementKeyboard,
	DEFAULT_PLACEMENT_CONFIG
} from '$services/placement-mode.service';
import type { PlacementConfig } from '$types/game-state.type';

describe('placement-mode.service', () => {
	const createMockDOMRect = (
		left: number,
		top: number,
		width: number,
		height: number
	): DOMRect => ({
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ({})
	});

	describe('calculatePlacementPosition', () => {
		it('should calculate position as percentage of container', () => {
			const rect = createMockDOMRect(0, 0, 100, 100);
			const position = calculatePlacementPosition(50, 75, rect);

			expect(position.x).toBe(50);
			expect(position.y).toBe(75);
		});

		it('should handle non-origin container position', () => {
			const rect = createMockDOMRect(100, 50, 200, 200);
			// clientX=200 - left=100 = 100, 100/200 * 100 = 50%
			// clientY=150 - top=50 = 100, 100/200 * 100 = 50%
			const position = calculatePlacementPosition(200, 150, rect);

			expect(position.x).toBe(50);
			expect(position.y).toBe(50);
		});

		it('should clamp negative values to 0', () => {
			const rect = createMockDOMRect(100, 100, 100, 100);
			// clientX=50 - left=100 = -50 -> clamped to 0
			const position = calculatePlacementPosition(50, 50, rect);

			expect(position.x).toBe(0);
			expect(position.y).toBe(0);
		});

		it('should clamp values exceeding container to 100', () => {
			const rect = createMockDOMRect(0, 0, 100, 100);
			const position = calculatePlacementPosition(150, 200, rect);

			expect(position.x).toBe(100);
			expect(position.y).toBe(100);
		});
	});

	describe('percentToPixels', () => {
		it('should convert percentage to pixels', () => {
			const { x, y } = percentToPixels(50, 25, 400, 600);

			expect(x).toBe(200); // 50% of 400
			expect(y).toBe(150); // 25% of 600
		});

		it('should handle edge cases', () => {
			expect(percentToPixels(0, 0, 100, 100)).toEqual({ x: 0, y: 0 });
			expect(percentToPixels(100, 100, 100, 100)).toEqual({ x: 100, y: 100 });
		});
	});

	describe('pixelsToPercent', () => {
		it('should convert pixels to percentage', () => {
			const { x, y } = pixelsToPercent(200, 150, 400, 600);

			expect(x).toBe(50); // 200/400 * 100
			expect(y).toBe(25); // 150/600 * 100
		});
	});

	describe('adjustScale', () => {
		const config: PlacementConfig = {
			minScale: 0.5,
			maxScale: 2.0,
			scaleStep: 0.1,
			defaultScale: 1.0
		};

		it('should increase scale by step', () => {
			const newScale = adjustScale(1.0, 1, config);
			expect(newScale).toBeCloseTo(1.1);
		});

		it('should decrease scale by step', () => {
			const newScale = adjustScale(1.0, -1, config);
			expect(newScale).toBeCloseTo(0.9);
		});

		it('should clamp at minimum', () => {
			const newScale = adjustScale(0.5, -1, config);
			expect(newScale).toBe(0.5);
		});

		it('should clamp at maximum', () => {
			const newScale = adjustScale(2.0, 1, config);
			expect(newScale).toBe(2.0);
		});

		it('should use default config if not provided', () => {
			const newScale = adjustScale(1.0, 1);
			expect(newScale).toBeCloseTo(1.1);
		});
	});

	describe('scaleFromWheelEvent', () => {
		it('should decrease scale for positive deltaY (scroll down)', () => {
			const newScale = scaleFromWheelEvent(100, 1.0);
			expect(newScale).toBeLessThan(1.0);
		});

		it('should increase scale for negative deltaY (scroll up)', () => {
			const newScale = scaleFromWheelEvent(-100, 1.0);
			expect(newScale).toBeGreaterThan(1.0);
		});
	});

	describe('createInitialPlacementState', () => {
		it('should create initial state', () => {
			const state = createInitialPlacementState();

			expect(state.isActive).toBe(false);
			expect(state.scale).toBe(DEFAULT_PLACEMENT_CONFIG.defaultScale);
			expect(state.position).toEqual({ x: 50, y: 50 });
			expect(state.itemType).toBe('stamp');
			expect(state.itemId).toBeNull();
		});
	});

	describe('activatePlacement', () => {
		it('should activate placement mode', () => {
			const initialState = createInitialPlacementState();
			const newState = activatePlacement(initialState, 'icon', 'icon-123');

			expect(newState.isActive).toBe(true);
			expect(newState.itemType).toBe('icon');
			expect(newState.itemId).toBe('icon-123');
			expect(newState.scale).toBe(DEFAULT_PLACEMENT_CONFIG.defaultScale);
			expect(newState.position).toEqual({ x: 50, y: 50 });
		});
	});

	describe('deactivatePlacement', () => {
		it('should deactivate placement mode', () => {
			const activeState = activatePlacement(createInitialPlacementState(), 'stamp', 'stamp-1');
			const newState = deactivatePlacement(activeState);

			expect(newState.isActive).toBe(false);
			expect(newState.itemId).toBeNull();
		});
	});

	describe('updatePosition', () => {
		it('should update position', () => {
			const state = createInitialPlacementState();
			const newState = updatePosition(state, 25, 75);

			expect(newState.position).toEqual({ x: 25, y: 75 });
		});
	});

	describe('updateScale', () => {
		it('should update scale', () => {
			const state = createInitialPlacementState();
			const newState = updateScale(state, 1.5);

			expect(newState.scale).toBe(1.5);
		});
	});

	describe('createPlacementModeController', () => {
		it('should create controller with correct methods', () => {
			const onStateChange = vi.fn();
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, onStateChange);

			expect(controller.enter).toBeInstanceOf(Function);
			expect(controller.exit).toBeInstanceOf(Function);
			expect(controller.updatePosition).toBeInstanceOf(Function);
			expect(controller.adjustScale).toBeInstanceOf(Function);
			expect(controller.handleWheel).toBeInstanceOf(Function);
			expect(controller.getState).toBeInstanceOf(Function);
			expect(controller.isActive).toBeInstanceOf(Function);
		});

		it('should not be active initially', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());

			expect(controller.isActive()).toBe(false);
		});

		it('should enter placement mode', () => {
			const onStateChange = vi.fn();
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, onStateChange);

			controller.enter('stamp', 'stamp-123');

			expect(controller.isActive()).toBe(true);
			expect(controller.getState().itemId).toBe('stamp-123');
			expect(onStateChange).toHaveBeenCalled();
		});

		it('should exit placement mode', () => {
			const onStateChange = vi.fn();
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, onStateChange);

			controller.enter('stamp', 'stamp-123');
			controller.exit();

			expect(controller.isActive()).toBe(false);
		});

		it('should update position', () => {
			const onStateChange = vi.fn();
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, onStateChange);
			const rect = createMockDOMRect(0, 0, 200, 200);

			controller.updatePosition(100, 100, rect);

			expect(controller.getState().position).toEqual({ x: 50, y: 50 });
		});

		it('should adjust scale', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());

			controller.adjustScale(1);

			expect(controller.getState().scale).toBeGreaterThan(DEFAULT_PLACEMENT_CONFIG.defaultScale);
		});

		it('should handle wheel events', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());
			const initialScale = controller.getState().scale;

			controller.handleWheel(-100); // Scroll up = increase

			expect(controller.getState().scale).toBeGreaterThan(initialScale);
		});
	});

	describe('handlePlacementKeyboard', () => {
		it('should return false when not active', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());
			const event = new KeyboardEvent('keydown', { key: 'Escape' });

			const result = handlePlacementKeyboard(event, controller);

			expect(result).toBe(false);
		});

		it('should handle Escape key', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());
			controller.enter('stamp', 'stamp-1');
			const event = new KeyboardEvent('keydown', { key: 'Escape' });

			const result = handlePlacementKeyboard(event, controller);

			expect(result).toBe(true);
			expect(controller.isActive()).toBe(false);
		});

		it('should handle + key for scale increase', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());
			controller.enter('stamp', 'stamp-1');
			const initialScale = controller.getState().scale;
			const event = new KeyboardEvent('keydown', { key: '+' });

			const result = handlePlacementKeyboard(event, controller);

			expect(result).toBe(true);
			expect(controller.getState().scale).toBeGreaterThan(initialScale);
		});

		it('should handle - key for scale decrease', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());
			controller.enter('stamp', 'stamp-1');
			const initialScale = controller.getState().scale;
			const event = new KeyboardEvent('keydown', { key: '-' });

			const result = handlePlacementKeyboard(event, controller);

			expect(result).toBe(true);
			expect(controller.getState().scale).toBeLessThan(initialScale);
		});

		it('should return false for unhandled keys', () => {
			const controller = createPlacementModeController(DEFAULT_PLACEMENT_CONFIG, vi.fn());
			controller.enter('stamp', 'stamp-1');
			const event = new KeyboardEvent('keydown', { key: 'a' });

			const result = handlePlacementKeyboard(event, controller);

			expect(result).toBe(false);
		});
	});

	describe('DEFAULT_PLACEMENT_CONFIG', () => {
		it('should have expected default values', () => {
			expect(DEFAULT_PLACEMENT_CONFIG.minScale).toBe(0.2);
			expect(DEFAULT_PLACEMENT_CONFIG.maxScale).toBe(2.0);
			expect(DEFAULT_PLACEMENT_CONFIG.scaleStep).toBe(0.1);
			expect(DEFAULT_PLACEMENT_CONFIG.defaultScale).toBe(1.0);
		});
	});
});
