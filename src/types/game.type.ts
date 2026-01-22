// Game menu types
export interface GameMenuItem {
	id: string;
	label: string;
	path: string;
	icon?: string;
	group?: string;
}

export interface GameMenuData {
	items: GameMenuItem[];
	generatedAt: string;
}
