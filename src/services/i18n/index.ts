import { browser } from '$app/environment';
import { register, init, locale } from 'svelte-i18n';

const LOCALE_STORAGE_KEY = 'game-locale';
const DEFAULT_LOCALE = 'en';

// Register locales
register('en', () => import('./locales/en.json'));
register('qq', () => import('./locales/qq.json'));

// Get saved locale from localStorage, or default to English
function getInitialLocale(): string {
	if (browser) {
		const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (saved) {
			return saved;
		}
	}
	return DEFAULT_LOCALE;
}

// Initialize i18n with English as default
init({
	fallbackLocale: DEFAULT_LOCALE,
	initialLocale: getInitialLocale()
});

// Subscribe to locale changes and persist to localStorage
if (browser) {
	locale.subscribe((value) => {
		if (value) {
			localStorage.setItem(LOCALE_STORAGE_KEY, value);
		}
	});
}
