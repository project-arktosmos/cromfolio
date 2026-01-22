import { ObjectServiceClass } from '$services/classes/object-service.class';
import type { Player } from '$types/player.type';

const DEFAULT_PLAYER: Player = {
	id: 'player',
	name: 'Adventurer',
	experience: 0,
	createdAt: new Date().toISOString(),
	lastPlayedAt: new Date().toISOString()
};

export const playerService = new ObjectServiceClass<Player>('player', DEFAULT_PLAYER);

export function addExperience(amount: number): void {
	const player = playerService.get();
	playerService.set({
		...player,
		experience: player.experience + amount,
		lastPlayedAt: new Date().toISOString()
	});
}

export function setPlayerName(name: string): void {
	const player = playerService.get();
	playerService.set({
		...player,
		name,
		lastPlayedAt: new Date().toISOString()
	});
}

export function resetPlayer(): void {
	playerService.set({
		...DEFAULT_PLAYER,
		createdAt: new Date().toISOString(),
		lastPlayedAt: new Date().toISOString()
	});
}
