import { formatDistanceStrict } from "date-fns";
import { ButtonStyle } from "discord-api-types/v10";
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ChatInputCommandInteraction,
	EmbedBuilder,
	time
} from "discord.js";

import { db } from "./db.js";
import { buildGameImage } from "./image/game.js";
import { reply } from "./util.js";

const buttonRow = (page: number, maxPage: number) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			// not 0 because customId must be unique
			.setCustomId("00")
			.setLabel("Newest")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`${page - 1}`)
			.setLabel("Newer")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`${page + 1}`)
			.setLabel("Older")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(page === maxPage - 1),
		new ButtonBuilder()
			// add 0 at the front to make it unique
			.setCustomId(`0${maxPage - 1}`)
			.setLabel("Oldest")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(page === maxPage - 1)
	);

export async function sendHistory(i: ChatInputCommandInteraction) {
	const history = await createHistory({
		userId: BigInt(i.user.id),
		page: 0
	});

	if (typeof history === "string") {
		await reply(i, history, { ephemeral: true });
		return;
	}

	const { embed, files, components } = history;

	await reply(i, embed, { files, components });
}

export async function sendHistoryPage(i: ButtonInteraction) {
	if (i.user.id !== i.message.interaction?.user.id) {
		await i.reply({
			content: "You didn't send this command!",
			ephemeral: true
		});
		return;
	}

	const history = await createHistory({
		userId: BigInt(i.user.id),
		page: parseInt(i.customId)
	});

	if (typeof history === "string") {
		await reply(i, history, { ephemeral: true });
		return;
	}

	const { embed, files, components } = history;

	await i.update({ embeds: [embed.setColor("#56a754")], files, components });
}

interface HistoryInput {
	userId: bigint;
	page: number;
}

interface HistoryEmbed {
	embed: EmbedBuilder;
	files: AttachmentBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
}

type HistoryOutput = string | HistoryEmbed;

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase();

async function createHistory({
	userId,
	page
}: HistoryInput): Promise<HistoryOutput> {
	const game = await db.game.findFirst({
		where: { userId, result: { not: "PLAYING" } },
		orderBy: { id: "desc" },
		skip: page,
		include: { guesses: true }
	});

	if (!game) return "You haven't finished a game yet!";

	const gameCount = await db.game.count({
		where: { userId, result: { not: "PLAYING" } }
	});

	const embed = new EmbedBuilder()
		.setTitle(`Game ${gameCount - page} of ${gameCount}`)
		.setImage("attachment://game.webp")
		.addFields(
			{
				name: "Time Started",
				value: time(game.startTime)
			},
			{
				name: "Time Ended",
				value: time(game.endTime!)
			},
			{
				name: "Duration",
				value: formatDistanceStrict(game.endTime!, game.startTime)
			},
			{
				name: "Word",
				value: `**${game.target}**`,
				inline: true
			},
			{
				name: "Result",
				value: `**${capitalize(game.result)}**`,
				inline: true
			}
		);

	const image = buildGameImage(
		game.target,
		game.guesses.map(g => g.guess),
		false
	);

	return {
		embed,
		files: [new AttachmentBuilder(image).setName("game.webp")],
		components: [buttonRow(page, gameCount)]
	};
}
