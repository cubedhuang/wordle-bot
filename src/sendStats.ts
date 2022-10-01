import {
	AttachmentBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder
} from "discord.js";

import { db } from "./db";
import { buildStatsImage } from "./image";
import { reply } from "./util";

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
			{
				ephemeral: true
			}
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
		files: [new AttachmentBuilder(image).setName("stats.webp")]
	});
}
