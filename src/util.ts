import {
	ButtonInteraction,
	Collection,
	CommandInteraction,
	EmbedBuilder,
	InteractionReplyOptions,
	SelectMenuInteraction
} from "discord.js";

export function range(length: number): Iterable<number>;
export function range(start: number, end: number): Iterable<number>;
export function range(start: number, end?: number): Iterable<number> {
	if (end === undefined) {
		end = start;
		start = 0;
	}

	return {
		[Symbol.iterator]: function* () {
			for (let i = start; i < end!; i++) {
				yield i;
			}
		}
	};
}

export function count<T>(array: T[], callback: (item: T) => boolean) {
	return array.reduce((count, item) => count + (callback(item) ? 1 : 0), 0);
}

export function takeTopCounts(values: string[], n: number): [string, number][] {
	const counts = new Collection<string, number>();

	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	return counts
		.sort((v1, v2, k1, k2) => v2 - v1 || k1.localeCompare(k2))
		.firstKey(n)
		.map(key => [key, counts.get(key)!]);
}

export function reply(
	i: ButtonInteraction | CommandInteraction | SelectMenuInteraction,
	content: string | EmbedBuilder,
	options?: InteractionReplyOptions
) {
	if (typeof content === "string") {
		return i.reply({
			embeds: [{ color: 0x56a754, description: content }],
			...options
		});
	} else {
		return i.reply({
			embeds: [content.setColor("#56a754")],
			...options
		});
	}
}
