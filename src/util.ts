import type {
	ButtonInteraction,
	CommandInteraction,
	EmbedBuilder,
	InteractionReplyOptions
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

export function reply(
	i: ButtonInteraction | CommandInteraction,
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
