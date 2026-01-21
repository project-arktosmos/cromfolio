// Admin menu types
export interface AdminMenuItem {
	id: string;
	label: string;
	path: string;
	icon?: string;
	group?: string;
}

export interface AdminMenuData {
	items: AdminMenuItem[];
	generatedAt: string;
}

// Settings - singleton application settings
export interface Settings {
	id: string;
	appName: string;
	theme: string;
	updatedAt: string;
}

// Item - example CRUD resource
export interface Item {
	id: string;
	name: string;
	description: string;
	category: string;
	createdAt: string;
	updatedAt: string;
}
