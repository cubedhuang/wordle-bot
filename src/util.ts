import {
	ApplicationCommand,
	ButtonInteraction,
	Client,
	Collection,
	CommandInteraction,
	EmbedBuilder,
	GuildResolvable,
	InteractionReplyOptions,
	StringSelectMenuInteraction
} from "discord.js";

export const isDev = process.argv.includes("dev");

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
	i: ButtonInteraction | CommandInteraction | StringSelectMenuInteraction,
	content: string | EmbedBuilder,
	options?: InteractionReplyOptions
) {
	const embed =
		typeof content === "string"
			? { color: 0x56a754, description: content }
			: content.setColor("#56a754");

	if (i.deferred) {
		return i.editReply({ embeds: [embed], ...options });
	} else {
		return i.reply({ embeds: [embed], ...options });
	}
}

const cachedIds = new Collection<string, string>();
let commands:
	| Collection<string, ApplicationCommand<{ guild: GuildResolvable }>>
	| undefined;

export async function command(client: Client, name: string) {
	if (cachedIds.has(name)) {
		return `</${name}:${cachedIds.get(name)}>`;
	}

	commands ??= await client.application?.commands.fetch({
		guildId: isDev ? "979976981850497074" : undefined
	});

	const id = commands?.find(c => c.name === name)?.id;

	if (id) {
		cachedIds.set(name, id);
		return `</${name}:${id}>`;
	} else {
		return `\`/${name}\``;
	}
}
