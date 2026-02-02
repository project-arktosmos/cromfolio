import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	getTotalSpreads,
	isCoverSpread,
	isWinnerSpread,
	getLeftPageIndex,
	getRightPageIndex,
	getSpreadForPage,
	hasRightPage,
	canFlipForward,
	canFlipBackward,
	getNextSpread,
	getPreviousSpread,
	createFlipController,
	createInitialAlbumViewState,
	DEFAULT_FLIP_CONFIG
} from '$services/album-view.service';

describe('album-view.service', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	describe('getTotalSpreads', () => {
		it('should include cover as first spread', () => {
			const totalPages = 10;
			const winnerPages = 2;
			// contentPages = 10 + 2 = 12
			// ceil(12/2) + 1 = 6 + 1 = 7
			const spreads = getTotalSpreads(totalPages, winnerPages);
			expect(spreads).toBe(7);
		});

		it('should handle zero pages', () => {
			const spreads = getTotalSpreads(0, 0);
			expect(spreads).toBe(1); // Just the cover
		});

		it('should handle odd number of pages', () => {
			const spreads = getTotalSpreads(9, 0);
			// ceil(9/2) + 1 = 5 + 1 = 6
			expect(spreads).toBe(6);
		});

		it('should default winner pages to 0', () => {
			const spreads = getTotalSpreads(4);
			// ceil(4/2) + 1 = 2 + 1 = 3
			expect(spreads).toBe(3);
		});
	});

	describe('isCoverSpread', () => {
		it('should return true for spread 0', () => {
			expect(isCoverSpread(0)).toBe(true);
		});

		it('should return false for non-zero spreads', () => {
			expect(isCoverSpread(1)).toBe(false);
			expect(isCoverSpread(5)).toBe(false);
		});
	});

	describe('isWinnerSpread', () => {
		it('should return false for cover spread', () => {
			expect(isWinnerSpread(0, 5)).toBe(false);
		});

		it('should return false for regular spreads', () => {
			expect(isWinnerSpread(1, 5)).toBe(false);
			expect(isWinnerSpread(5, 5)).toBe(false);
		});

		it('should return true for spreads beyond regular count', () => {
			expect(isWinnerSpread(6, 5)).toBe(true);
			expect(isWinnerSpread(10, 5)).toBe(true);
		});
	});

	describe('getLeftPageIndex', () => {
		it('should return -1 for cover spread', () => {
			expect(getLeftPageIndex(0)).toBe(-1);
		});

		it('should return correct page index for spread 1', () => {
			expect(getLeftPageIndex(1)).toBe(0);
		});

		it('should return correct page index for later spreads', () => {
			expect(getLeftPageIndex(2)).toBe(2);
			expect(getLeftPageIndex(3)).toBe(4);
			expect(getLeftPageIndex(5)).toBe(8);
		});
	});

	describe('getRightPageIndex', () => {
		it('should return -1 for cover spread', () => {
			expect(getRightPageIndex(0)).toBe(-1);
		});

		it('should return correct page index for spread 1', () => {
			expect(getRightPageIndex(1)).toBe(1);
		});

		it('should return correct page index for later spreads', () => {
			expect(getRightPageIndex(2)).toBe(3);
			expect(getRightPageIndex(3)).toBe(5);
		});
	});

	describe('getSpreadForPage', () => {
		it('should return cover for negative page index', () => {
			expect(getSpreadForPage(-1)).toBe(0);
		});

		it('should return correct spread for pages', () => {
			expect(getSpreadForPage(0)).toBe(1); // Page 0 is in spread 1
			expect(getSpreadForPage(1)).toBe(1); // Page 1 is in spread 1
			expect(getSpreadForPage(2)).toBe(2); // Page 2 is in spread 2
			expect(getSpreadForPage(3)).toBe(2); // Page 3 is in spread 2
			expect(getSpreadForPage(4)).toBe(3); // Page 4 is in spread 3
		});
	});

	describe('hasRightPage', () => {
		it('should return false for cover spread', () => {
			expect(hasRightPage(0, 10)).toBe(false);
		});

		it('should return true when right page exists', () => {
			expect(hasRightPage(1, 10)).toBe(true);
			expect(hasRightPage(2, 10)).toBe(true);
		});

		it('should return false when right page does not exist', () => {
			// 5 pages: spread 3 has pages 4 and 5 (index 4 exists, 5 doesn't)
			expect(hasRightPage(3, 5)).toBe(false);
		});
	});

	describe('canFlipForward', () => {
		it('should return true when not at last spread', () => {
			expect(canFlipForward(0, 5)).toBe(true);
			expect(canFlipForward(3, 5)).toBe(true);
		});

		it('should return false at last spread', () => {
			expect(canFlipForward(4, 5)).toBe(false);
		});
	});

	describe('canFlipBackward', () => {
		it('should return true when not at first spread', () => {
			expect(canFlipBackward(1)).toBe(true);
			expect(canFlipBackward(5)).toBe(true);
		});

		it('should return false at first spread', () => {
			expect(canFlipBackward(0)).toBe(false);
		});
	});

	describe('getNextSpread', () => {
		it('should increment spread', () => {
			expect(getNextSpread(0, 5)).toBe(1);
			expect(getNextSpread(2, 5)).toBe(3);
		});

		it('should clamp at maximum', () => {
			expect(getNextSpread(4, 5)).toBe(4);
			expect(getNextSpread(10, 5)).toBe(4);
		});
	});

	describe('getPreviousSpread', () => {
		it('should decrement spread', () => {
			expect(getPreviousSpread(5)).toBe(4);
			expect(getPreviousSpread(2)).toBe(1);
		});

		it('should clamp at zero', () => {
			expect(getPreviousSpread(0)).toBe(0);
		});
	});

	describe('createFlipController', () => {
		it('should create controller with correct methods', () => {
			const onStart = vi.fn();
			const onComplete = vi.fn();
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, onStart, onComplete);

			expect(controller.flipForward).toBeInstanceOf(Function);
			expect(controller.flipBackward).toBeInstanceOf(Function);
			expect(controller.isFlipping).toBeInstanceOf(Function);
			expect(controller.cancel).toBeInstanceOf(Function);
		});

		it('should not be flipping initially', () => {
			const controller = createFlipController(
				DEFAULT_FLIP_CONFIG,
				vi.fn(),
				vi.fn()
			);

			expect(controller.isFlipping()).toBe(false);
		});

		it('should flip forward and call callbacks', () => {
			vi.useFakeTimers();
			const onStart = vi.fn();
			const onComplete = vi.fn();
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, onStart, onComplete);

			const result = controller.flipForward(0, 5);

			expect(result).toBe(true);
			expect(controller.isFlipping()).toBe(true);
			expect(onStart).toHaveBeenCalledWith('forward', 1);

			vi.advanceTimersByTime(DEFAULT_FLIP_CONFIG.duration);

			expect(controller.isFlipping()).toBe(false);
			expect(onComplete).toHaveBeenCalledWith(1);
		});

		it('should flip backward and call callbacks', () => {
			vi.useFakeTimers();
			const onStart = vi.fn();
			const onComplete = vi.fn();
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, onStart, onComplete);

			const result = controller.flipBackward(3);

			expect(result).toBe(true);
			expect(controller.isFlipping()).toBe(true);
			expect(onStart).toHaveBeenCalledWith('backward', 2);

			vi.advanceTimersByTime(DEFAULT_FLIP_CONFIG.duration);

			expect(controller.isFlipping()).toBe(false);
			expect(onComplete).toHaveBeenCalledWith(2);
		});

		it('should prevent flip when already flipping', () => {
			vi.useFakeTimers();
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, vi.fn(), vi.fn());

			controller.flipForward(0, 5);
			const secondResult = controller.flipForward(1, 5);

			expect(secondResult).toBe(false);
		});

		it('should prevent forward flip at last spread', () => {
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, vi.fn(), vi.fn());

			const result = controller.flipForward(4, 5);

			expect(result).toBe(false);
		});

		it('should prevent backward flip at first spread', () => {
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, vi.fn(), vi.fn());

			const result = controller.flipBackward(0);

			expect(result).toBe(false);
		});

		it('should cancel ongoing flip', () => {
			vi.useFakeTimers();
			const onComplete = vi.fn();
			const controller = createFlipController(DEFAULT_FLIP_CONFIG, vi.fn(), onComplete);

			controller.flipForward(0, 5);
			controller.cancel();

			expect(controller.isFlipping()).toBe(false);
			vi.advanceTimersByTime(DEFAULT_FLIP_CONFIG.duration);
			expect(onComplete).not.toHaveBeenCalled();
		});
	});

	describe('createInitialAlbumViewState', () => {
		it('should create initial state with null collection', () => {
			const state = createInitialAlbumViewState();

			expect(state.selectedCollectionId).toBeNull();
			expect(state.currentSpread).toBe(0);
			expect(state.isFlipping).toBe(false);
			expect(state.flipDirection).toBeNull();
			expect(state.targetSpread).toBeNull();
		});

		it('should create initial state with provided collection ID', () => {
			const state = createInitialAlbumViewState('collection-123');

			expect(state.selectedCollectionId).toBe('collection-123');
		});
	});

	describe('DEFAULT_FLIP_CONFIG', () => {
		it('should have expected default values', () => {
			expect(DEFAULT_FLIP_CONFIG.duration).toBe(600);
			expect(DEFAULT_FLIP_CONFIG.easing).toBe('ease-in-out');
		});
	});
});
