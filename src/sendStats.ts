import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	Collection,
	EmbedBuilder
} from "discord.js";

import { db } from "./db";
import { buildStatsGuessesImage, buildStatsImage } from "./image";
import { reply } from "./util";

const guessesButton = (id: string) =>
	new ButtonBuilder()
		.setLabel("Guesses")
		.setStyle(ButtonStyle.Primary)
		.setEmoji("❓")
		.setCustomId(id);
const buttonRow = (id: string) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(guessesButton(id));

function count<T>(array: T[], callback: (item: T) => boolean) {
	return array.reduce((count, item) => count + (callback(item) ? 1 : 0), 0);
}

export async function sendStats(i: ChatInputCommandInteraction) {
	const targetUser = i.options.getUser("user") ?? i.user;

	const user = await db.user.findUnique({
		where: { id: BigInt(targetUser.id) },
		include: {
			games: {
				include: {
					_count: {
						select: { guesses: true }
					}
				}
			}
		}
	});

	if (!user?.games.length) {
		await reply(
			i,
			`${
				targetUser.id === i.user.id
					? "You haven't"
					: `${targetUser} hasn't`
			} played a game yet!`,
			{ ephemeral: true }
		);
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle(
			`${
				targetUser.id === i.user.id
					? "Your"
					: `${targetUser.username}'s`
			} Wordle Statistics`
		)
		.setImage("attachment://stats.webp");

	let streak = 0;
	let maxStreak = 0;
	const dist = [0, 0, 0, 0, 0, 0];

	for (const game of user.games) {
		if (game.result === "WIN") {
			streak++;
			dist[game._count.guesses - 1]++;
		} else if (game.result !== "PLAYING") {
			if (streak > maxStreak) {
				maxStreak = streak;
			}

			streak = 0;
		}
	}

	if (streak > maxStreak) {
		maxStreak = streak;
	}

	const image = buildStatsImage({
		started: user.games.length,
		wins: count(user.games, game => game.result === "WIN"),
		losses: count(user.games, game => game.result === "LOSS"),
		quits: count(user.games, game => game.result === "QUIT"),
		streak,
		maxStreak,
		dist
	});

	await reply(i, embed, {
		files: [new AttachmentBuilder(image).setName("stats.webp")],
		components: [buttonRow(targetUser.id)]
	});
}

export async function sendGuessesStats(i: ButtonInteraction) {
	const targetUserId = i.customId;

	const user = await db.user.findUnique({
		where: { id: BigInt(targetUserId) },
		include: { games: { include: { guesses: true } } }
	});

	if (!user?.games.length) {
		await reply(
			i,
			`${
				targetUserId === i.user.id
					? "You haven't"
					: `<@${targetUserId}> hasn't`
			} played a game yet!`,
			{ ephemeral: true }
		);
		return;
	}

	const guesses = user.games
		.map(game => game.guesses)
		.flat()
		.map(g => g.guess);

	if (!guesses.length) {
		await reply(
			i,
			`${
				targetUserId === i.user.id
					? "You haven't"
					: `<@${targetUserId}> hasn't`
			} made any guesses yet!`,
			{ ephemeral: true }
		);
		return;
	}

	const embed = new EmbedBuilder().setTitle("Wordle Statistics: Guesses");

	const wonGames = user.games.filter(game => game.result === "WIN");

	const image = buildStatsGuessesImage({
		top: takeTopCounts(guesses, 10),
		total: guesses.length,
		unique: new Set(guesses).size,
		perGame: guesses.length / user.games.length,
		perWin:
			wonGames.reduce((sum, game) => sum + game.guesses.length, 0) /
			wonGames.length
	});

	await reply(i, embed.setImage("attachment://stats.webp"), {
		files: [new AttachmentBuilder(image).setName("stats.webp")]
	});
}

function takeTopCounts(values: string[], n: number): [string, number][] {
	const counts = new Collection<string, number>();

	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	return counts
		.sort((v1, v2, k1, k2) => v2 - v1 || k1.localeCompare(k2))
		.firstKey(n)
		.map(key => [key, counts.get(key)!]);
}
