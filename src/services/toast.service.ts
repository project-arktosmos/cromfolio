import { writable } from 'svelte/store';
import type { ThemeColors } from '$types/core.type';

export interface Toast {
	id: string;
	message: string;
	type: ThemeColors;
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(message: string, type: ThemeColors = 'info' as ThemeColors, duration = 3000) {
		const id = crypto.randomUUID();
		const toast: Toast = { id, message, type, duration };

		update((toasts) => [...toasts, toast]);

		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}

		return id;
	}

	function remove(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	function updateMessage(id: string, message: string) {
		update((toasts) => toasts.map((t) => (t.id === id ? { ...t, message } : t)));
	}

	function clear() {
		update(() => []);
	}

	return {
		subscribe,
		add,
		remove,
		updateMessage,
		clear,
		success: (message: string, duration?: number) =>
			add(message, 'success' as ThemeColors, duration),
		error: (message: string, duration?: number) => {
			console.error('[Toast Error]', message);
			return add(message, 'error' as ThemeColors, duration ?? 5000);
		},
		warning: (message: string, duration?: number) =>
			add(message, 'warning' as ThemeColors, duration),
		info: (message: string, duration?: number) => add(message, 'info' as ThemeColors, duration)
	};
}

export const toastService = createToastStore();
