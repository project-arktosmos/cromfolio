export interface StampPack {
	id: string;
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
	id: string;
	packId: string;
	imagePath: string;
	emojis: string | null;
	createdAt: string;
}
