/**
 * Telegram Sticker Types
 *
 * Based on Telegram Bot API specifications:
 * - TGS: gzipped Lottie JSON files (application/x-tgsticker)
 * - WebP: static image stickers (image/webp)
 * - WebM: VP9 video stickers (video/webm)
 *
 * @see https://core.telegram.org/api/stickers
 * @see https://core.telegram.org/bots/api#sticker
 */

export type TelegramStickerFormat = 'static' | 'animated' | 'video';
export type TelegramStickerType = 'regular' | 'mask' | 'custom_emoji';

export interface TelegramSticker {
	file_id: string;
	file_unique_id: string;
	type: TelegramStickerType;
	width: number;
	height: number;
	is_animated: boolean;
	is_video: boolean;
	emoji?: string;
	set_name?: string;
	file_size?: number;
	thumbnail?: TelegramPhotoSize;
	mask_position?: TelegramMaskPosition;
	custom_emoji_id?: string;
	needs_repainting?: boolean;
	premium_animation?: TelegramFile;
}

export interface TelegramStickerSet {
	name: string;
	title: string;
	sticker_type: TelegramStickerType;
	stickers: TelegramSticker[];
	thumbnail?: TelegramPhotoSize;
}

export interface TelegramPhotoSize {
	file_id: string;
	file_unique_id: string;
	width: number;
	height: number;
	file_size?: number;
}

export interface TelegramMaskPosition {
	point: 'forehead' | 'eyes' | 'mouth' | 'chin';
	x_shift: number;
	y_shift: number;
	scale: number;
}

export interface TelegramFile {
	file_id: string;
	file_unique_id: string;
	file_size?: number;
	file_path?: string;
}

/**
 * Local representation for imported sticker files
 */
export interface ImportedTelegramSticker {
	id: string;
	filename: string;
	format: TelegramStickerFormat;
	mimeType: string;
	size: number;
	width: number;
	height: number;
	emoji?: string;
	dataUrl: string; // Base64 data URL for preview
	lottieData?: object; // Parsed Lottie JSON for TGS files
}

export interface ImportedTelegramStickerPack {
	id: string;
	name: string;
	stickers: ImportedTelegramSticker[];
	importedAt: string;
}

/**
 * MIME type constants for Telegram stickers
 */
export const TELEGRAM_STICKER_MIME_TYPES = {
	TGS: 'application/x-tgsticker',
	WEBP: 'image/webp',
	WEBM: 'video/webm'
} as const;

/**
 * File extension to format mapping
 */
export const TELEGRAM_STICKER_EXTENSIONS: Record<string, TelegramStickerFormat> = {
	'.tgs': 'animated',
	'.webp': 'static',
	'.webm': 'video'
};
