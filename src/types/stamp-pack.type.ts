export interface StampPack {
	id: number;
	source: string;
	name: string;
	author: string;
	trayImage: string | null;
	packFile: string | null;
	stickerCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface Stamp {
	id: number;
	packId: number;
	imagePath: string;
	emojis: string | null;
	createdAt: string;
}
