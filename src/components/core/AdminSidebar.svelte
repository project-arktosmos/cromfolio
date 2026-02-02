<script lang="ts">
	import classNames from 'classnames';
	import type { AdminMenuItem } from '$types/admin.type';
	import { page } from '$app/stores';

	interface Props {
		items?: AdminMenuItem[];
		classes?: string;
	}

	interface MenuGroup {
		name: string | null;
		items: AdminMenuItem[];
	}

	let { items = [], classes = '' }: Props = $props();

	let currentPath = $derived($page.url.pathname);

	// Group items by their group property, maintaining order
	let groupedItems = $derived.by(() => {
		const groups: MenuGroup[] = [];
		const groupMap = new Map<string | null, MenuGroup>();

		for (const item of items) {
			const groupName = item.group ?? null;

			if (!groupMap.has(groupName)) {
				const group: MenuGroup = { name: groupName, items: [] };
				groupMap.set(groupName, group);
				groups.push(group);
			}

			groupMap.get(groupName)!.items.push(item);
		}

		return groups;
	});

	let wrapperClasses = $derived(
		classNames(
			'min-h-screen',
			'w-64',
			'bg-base-200',
			'border-r',
			'border-base-300',
			'flex',
			'flex-col',
			classes
		)
	);

	function isActive(itemPath: string): boolean {
		return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
	}

	function getLinkClasses(itemPath: string): string {
		return classNames('px-4', 'py-3', 'text-sm', 'transition-colors', 'hover:bg-base-300', {
			'bg-primary text-primary-content hover:bg-primary': isActive(itemPath),
			'text-base-content': !isActive(itemPath)
		});
	}

	function getGroupLinkClasses(itemPath: string): string {
		return classNames('px-4', 'py-2', 'text-sm', 'transition-colors', 'hover:bg-base-300', {
			'bg-primary text-primary-content hover:bg-primary': isActive(itemPath),
			'text-base-content': !isActive(itemPath)
		});
	}
</script>

<aside class={wrapperClasses}>
	<div class="border-base-300 border-b p-4">
		<a href="/admin" class="text-base-content text-xl font-bold">Admin</a>
	</div>

	<nav class="flex-1 overflow-y-auto py-2">
		<ul class="menu p-0">
			{#each groupedItems as group}
				{#if group.name === null}
					{#each group.items as item (item.id)}
						<li>
							<a href={item.path} class={getLinkClasses(item.path)}>
								{item.label}
							</a>
						</li>
					{/each}
				{:else}
					<li class="mt-2">
						<span
							class="text-base-content/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
						>
							{group.name}
						</span>
						<ul class="pl-2">
							{#each group.items as item (item.id)}
								<li>
									<a href={item.path} class={getGroupLinkClasses(item.path)}>
										{item.label}
									</a>
								</li>
							{/each}
						</ul>
					</li>
				{/if}
			{/each}
		</ul>
	</nav>
</aside>
