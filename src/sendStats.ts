import {
	SelectMenuBuilder,
	SelectMenuOptionBuilder,
	time
} from "@discordjs/builders";
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ChatInputCommandInteraction,
	Client,
	EmbedBuilder,
	StringSelectMenuInteraction,
	User
} from "discord.js";

import { db } from "./db.js";
import { buildStatsImage } from "./image/stats.js";
import { buildStatsGuessesImage } from "./image/statsGuesses.js";
import { count, reply, takeTopCounts } from "./util.js";

enum StatsView {
	General = "General",
	Global = "Global",
	PersonalGuesses = "PersonalGuesses",
	GlobalGuesses = "GlobalGuesses",
	BotStats = "BotStats"
}

const statsOptions = (id: string, value: StatsView) =>
	new SelectMenuBuilder().setCustomId(id).addOptions([
		new SelectMenuOptionBuilder()
			.setLabel("General")
			.setDescription(
				"General personal statistics, like the Wordle website."
			)
			.setValue(StatsView.General)
			.setEmoji({ name: "wordle", id: "1025939109329514546" })
			.setDefault(value === StatsView.General),
		new SelectMenuOptionBuilder()
			.setLabel("Global")
			.setDescription("Global statistics including everyone's games.")
			.setValue(StatsView.Global)
			.setEmoji({ name: "🌏" })
			.setDefault(value === StatsView.Global),
		new SelectMenuOptionBuilder()
			.setLabel("Personal Guesses")
			.setDescription("Statistics about your guesses.")
			.setEmoji({ name: "📊" })
			.setValue(StatsView.PersonalGuesses)
			.setDefault(value === StatsView.PersonalGuesses),
		new SelectMenuOptionBuilder()
			.setLabel("Global Guesses")
			.setDescription("Statistics about all guesses made by everyone.")
			.setEmoji({ name: "🌎" })
			.setValue(StatsView.GlobalGuesses)
			.setDefault(value === StatsView.GlobalGuesses),
		new SelectMenuOptionBuilder()
			.setLabel("Bot Stats")
			.setDescription("Statistics just about the bot.")
			.setEmoji({ name: "🤖" })
			.setValue(StatsView.BotStats)
			.setDefault(value === StatsView.BotStats)
	]);
const statsRow = (id: string, value = StatsView.General) =>
	new ActionRowBuilder<SelectMenuBuilder>().addComponents(
		statsOptions(id, value)
	);

export async function sendGeneralStats(i: ChatInputCommandInteraction) {
	await i.deferReply();

	const targetUser = i.options.getUser("user") ?? i.user;

	const stats = await createGeneralStats({
		client: i.client,
		receiver: i.user,
		target: targetUser
	});

	if (typeof stats === "string") {
		await reply(i, stats, { ephemeral: true });
		return;
	}

	const { embed, files } = stats;

	await reply(i, embed, {
		files,
		components: [statsRow(targetUser.id)]
	});
}

interface StatsInput {
	client: Client;
	receiver: User;
	target: User;
}

interface StatsEmbedInfo {
	embed: EmbedBuilder;
	files?: AttachmentBuilder[];
}

type StatsOutput = string | StatsEmbedInfo;

const specificStatsEmbeds: Record<
	StatsView,
	(info: StatsInput) => Promise<StatsOutput>
> = {
	[StatsView.General]: createGeneralStats,
	[StatsView.Global]: createGlobalStats,
	[StatsView.PersonalGuesses]: createPersonalGuessesStats,
	[StatsView.GlobalGuesses]: createGlobalGuessesStats,
	[StatsView.BotStats]: createBotStats
};

export async function sendSpecificStats(i: StringSelectMenuInteraction) {
	if (i.user.id !== i.message.interaction?.user.id) {
		await reply(i, "You didn't send this command!", {
			ephemeral: true
		});
		return;
	}

	await i.deferUpdate();

	const targetId = i.customId;

	const stats = await specificStatsEmbeds[i.values[0] as StatsView]({
		client: i.client,
		receiver: i.user,
		target: await i.client.users.fetch(targetId)
	});

	if (typeof stats === "string") {
		await i.followUp({
			embeds: [
				{
					title: "Error",
					description: stats,
					color: 0x56a754
				}
			],
			components: [statsRow(targetId, i.values[0] as StatsView)]
		});
		return;
	}

	const { embed, files } = stats;

	await i.followUp({
		embeds: [embed.setColor("#56a754")],
		files: files ?? [],
		components: [statsRow(targetId, i.values[0] as StatsView)]
	});
}

async function createGeneralStats({
	receiver,
	target
}: StatsInput): Promise<StatsOutput> {
	const user = await db.user.findUnique({
		where: { id: BigInt(target.id) },
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
		return `${
			target.id === receiver.id ? "You haven't" : `<@${target.id}> hasn't`
		} played a game yet!`;
	}

	const embed = new EmbedBuilder()
		.setTitle(
			`${
				target.id === receiver.id ? "Your" : `${target.username}'s`
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

	return {
		embed,
		files: [new AttachmentBuilder(image).setName("stats.webp")]
	};
}

async function createGlobalStats(): Promise<StatsOutput> {
	const embed = new EmbedBuilder()
		.setTitle("Global Wordle Statistics")
		.setImage("attachment://stats.webp");

	const image = buildStatsImage({
		started: await db.game.count(),
		wins: await db.game.count({ where: { result: "WIN" } }),
		losses: await db.game.count({ where: { result: "LOSS" } }),
		quits: await db.game.count({ where: { result: "QUIT" } }),

		dist: (
			(await db.$queryRaw`
				SELECT COUNT(*) AS amount, g."guessCount"
				FROM (
					SELECT game.id, COUNT(guess.id) AS "guessCount"
					FROM "Game" game
					LEFT JOIN "Guess" guess ON game.id = guess."gameId"
					WHERE game.result = 'WIN'
					GROUP BY game.id
				) AS g
				GROUP BY g."guessCount"
				ORDER BY g."guessCount"
			`) as { amount: bigint; guessCount: bigint }[]
		).reduce(
			(acc, { amount, guessCount }) => {
				if (0 < guessCount && guessCount <= 6)
					acc[Number(guessCount) - 1] = Number(amount);
				return acc;
			},
			[0, 0, 0, 0, 0, 0]
		)
	});

	return {
		embed,
		files: [new AttachmentBuilder(image).setName("stats.webp")]
	};
}

async function createPersonalGuessesStats({
	receiver,
	target
}: StatsInput): Promise<StatsOutput> {
	const user = await db.user.findUnique({
		where: { id: BigInt(target.id) },
		include: {
			games: { include: { guesses: true } },
			activeGame: { select: { _count: { select: { guesses: true } } } }
		}
	});

	if (!user?.games.length) {
		return `${
			target.id === receiver.id ? "You haven't" : `<@${target.id}> hasn't`
		} played a game yet!`;
	}

	const guesses = user.games
		.map(game => game.guesses)
		.flat()
		.map(g => g.guess);

	if (!guesses.length) {
		return `${
			target.id === receiver.id ? "You haven't" : `<@${target.id}> hasn't`
		} made any guesses yet!`;
	}

	const firstGuesses = user.games
		.map(game => game.guesses[0]?.guess)
		.filter(g => !!g);

	const embed = new EmbedBuilder()
		.setTitle(
			`${
				target.id === receiver.id ? "Your" : `${target.username}'s`
			} Wordle Statistics: Guesses`
		)
		.setImage("attachment://stats.webp");

	const wonGames = user.games.filter(game => game.result === "WIN");

	const image = buildStatsGuessesImage({
		topTotal: takeTopCounts(guesses, 10),
		topFirst: takeTopCounts(firstGuesses, 10),
		total: guesses.length,
		unique: new Set(guesses).size,
		perGame:
			(guesses.length - (user.activeGame?._count.guesses ?? 0)) /
			(user.games.length - (user.activeGame ? 1 : 0)),
		perWin:
			wonGames.reduce((sum, game) => sum + game.guesses.length, 0) /
			wonGames.length
	});

	return {
		embed,
		files: [new AttachmentBuilder(image).setName("stats.webp")]
	};
}

async function createGlobalGuessesStats(): Promise<StatsOutput> {
	const totalGuesses = await db.guess.count({
		where: { game: { result: { not: "PLAYING" } } }
	});

	const image = buildStatsGuessesImage({
		topTotal: (
			await db.guess.groupBy({
				where: { game: { result: { not: "PLAYING" } } },
				by: ["guess"],
				_count: { guess: true },
				orderBy: { _count: { guess: "desc" } },
				take: 10
			})
		).map(g => [g.guess, g._count.guess]),

		// same as topTotal but only for the first guess of each game
		topFirst: (
			(await db.$queryRaw`
				SELECT guess, COUNT(guess) AS count
				FROM "Guess"
				WHERE "gameId" IN (
					SELECT id
					FROM "Game"
					WHERE result != 'PLAYING'
				)
				AND id IN (
					SELECT MIN(id)
					FROM "Guess"
					GROUP BY "gameId"
				)
				GROUP BY guess
				ORDER BY count DESC
				LIMIT 10
			`) as { guess: string; count: bigint }[]
		).map(g => [g.guess, Number(g.count)]),

		total: totalGuesses,

		// prisma count doesn't support DISTINCT
		unique: Number(
			(
				(await db.$queryRaw`SELECT COUNT(DISTINCT guess) FROM "Guess"`) as {
					count: bigint;
				}[]
			)[0].count
		),

		perGame:
			totalGuesses /
			(await db.game.count({ where: { result: { not: "PLAYING" } } })),

		perWin:
			(await db.guess.count({
				where: { game: { result: "WIN" } }
			})) / (await db.game.count({ where: { result: "WIN" } }))
	});

	const embed = new EmbedBuilder()
		.setTitle("Global Wordle Statistics: Guesses")
		.setImage("attachment://stats.webp");

	return {
		embed,
		files: [new AttachmentBuilder(image).setName("stats.webp")]
	};
}

async function createBotStats({ client }: StatsInput): Promise<StatsOutput> {
	const numberFormat = new Intl.NumberFormat("en-US");
	const f = (n: number) => numberFormat.format(n);

	const globalServers =
		(
			(await client.shard?.fetchClientValues(
				"guilds.cache.size"
			)) as number[]
		)?.reduce((a, b) => a + b, 0) ?? client.guilds.cache.size;
	const globalUsers =
		(
			(await client.shard?.broadcastEval(c =>
				c.guilds.cache.reduce((a, g) => a + g.memberCount, 0)
			)) as number[]
		)?.reduce((a, b) => a + b, 0) ??
		client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

	const shardServers = client.guilds.cache.size;
	const shardUsers = client.guilds.cache.reduce(
		(a, g) => a + g.memberCount,
		0
	);

	return {
		embed: new EmbedBuilder()
			.setTitle("Bot Statistics")
			.setFields(
				{
					name: "Global",
					value: `
Shards: ${client.shard?.count ?? 1}
Servers: ${f(globalServers)}
Users: ${f(globalUsers)}
`.trim(),
					inline: true
				},
				{
					name: `Shard`,
					value: `
ID: ${client.shard?.ids[0] ?? 0}
Servers: ${f(shardServers)}
Users: ${f(shardUsers)}
`.trim(),
					inline: true
				},
				{
					name: "Session Started",
					value: time(client.readyAt ?? new Date(), "R")
				}
			)
			.setThumbnail(client.user?.displayAvatarURL({ size: 512 }) ?? "")
	};
}
