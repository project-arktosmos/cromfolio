/**
 * WhatsApp Sticker Pack Type Definitions
 * Supports .wastickers file format (ZIP with title.txt, author.txt, stickers)
 */

export interface WhatsAppSticker {
	image_file: string;
	emojis: string[];
	accessibility_text?: string;
}

export interface LoadedWhatsAppSticker extends WhatsAppSticker {
	dataUrl: string;
}

export interface LoadedWhatsAppStickerPack {
	identifier: string;
	name: string;
	publisher: string;
	tray_image_file: string;
	trayDataUrl: string;
	stickers: LoadedWhatsAppSticker[];
	folderPath: string;
	animated_sticker_pack?: boolean;
}
