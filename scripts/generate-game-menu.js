import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const gameRoutesPath = join(__dirname, '../src/routes/game');
const groupsConfigPath = join(__dirname, '../src/data/game-menu-groups.json');
const outputPath = join(__dirname, '../src/data/game-menu.json');

/**
 * Convert a route folder name to a readable label
 * e.g., "characters" -> "Characters", "user-settings" -> "User Settings"
 */
function toLabel(folderName) {
	return folderName
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Load group configuration from game-menu-groups.json
 * Returns a map of item id -> group name
 */
function loadGroupConfig() {
	const idToGroup = new Map();

	try {
		const configContent = readFileSync(groupsConfigPath, 'utf-8');
		const config = JSON.parse(configContent);

		for (const [groupName, itemIds] of Object.entries(config.groups)) {
			for (const id of itemIds) {
				idToGroup.set(id, groupName);
			}
		}
	} catch {
		// No groups config found, all items will be ungrouped
	}

	return idToGroup;
}

/**
 * Scan the game routes directory and generate menu items
 */
function generateMenuItems() {
	const idToGroup = loadGroupConfig();
	const ungroupedItems = [];
	const groupedItems = [];

	try {
		const entries = readdirSync(gameRoutesPath, { withFileTypes: true });

		for (const entry of entries) {
			// Only process directories (subpages)
			if (entry.isDirectory()) {
				const folderName = entry.name;
				const folderPath = join(gameRoutesPath, folderName);

				// Check if it has a +page.svelte file (valid route)
				try {
					const files = readdirSync(folderPath);
					if (files.includes('+page.svelte')) {
						const item = {
							id: folderName,
							label: toLabel(folderName),
							path: `/game/${folderName}`
						};

						const group = idToGroup.get(folderName);
						if (group) {
							item.group = group;
							groupedItems.push(item);
						} else {
							ungroupedItems.push(item);
						}
					}
				} catch {
					// Skip if we can't read the directory
				}
			}
		}

		// Sort ungrouped items alphabetically
		ungroupedItems.sort((a, b) => a.label.localeCompare(b.label));

		// Sort grouped items by group order (from config), then alphabetically within group
		const groupOrder = [...new Set(groupedItems.map((item) => item.group))];
		groupedItems.sort((a, b) => {
			const groupIndexA = groupOrder.indexOf(a.group);
			const groupIndexB = groupOrder.indexOf(b.group);
			if (groupIndexA !== groupIndexB) {
				return groupIndexA - groupIndexB;
			}
			return a.label.localeCompare(b.label);
		});
	} catch (error) {
		console.warn('Game routes directory not found, creating empty menu');
	}

	// Ungrouped items first, then grouped items
	return [...ungroupedItems, ...groupedItems];
}

try {
	const items = generateMenuItems();

	const menuData = {
		items,
		generatedAt: new Date().toISOString()
	};

	writeFileSync(outputPath, JSON.stringify(menuData, null, '\t'));

	console.log(`✓ Generated game-menu.json with ${items.length} items`);
} catch (error) {
	console.error('Error generating game menu:', error);
	process.exit(1);
}
