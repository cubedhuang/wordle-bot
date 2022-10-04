import "dotenv/config";

import {
	ActivityType,
	ChatInputCommandInteraction,
	Client,
	Collection
} from "discord.js";

import { Game } from "./Game";
import { helpEmbed, rulesEmbed } from "./info";
import { sendHistory, sendHistoryPage } from "./sendHistory";
import { sendGeneralStats, sendSpecificStats } from "./sendStats";
import { isDev, reply } from "./util";

process.on("uncaughtException", err => {
	console.error("Uncaught", err);
});
process.on("unhandledRejection", err => {
	console.error("Unhandled", err);
});

const client = new Client({
	intents: ["Guilds"],
	allowedMentions: {
		parse: ["users"],
		repliedUser: false
	},
	presence: {
		activities: [{ name: "/wordle", type: ActivityType.Playing }]
	}
});

const games = new Collection<string, Game>();

function getGame(id: string) {
	return games.get(id) ?? games.set(id, new Game()).get(id)!;
}

client.on("ready", client => {
	console.log(`Logged in as ${client.user.tag}!`);

	setInterval(() => {
		client.user.setActivity("/wordle", { type: ActivityType.Playing });
	}, 1000 * 60 * 30);
});

const commands: Record<
	string,
	(i: ChatInputCommandInteraction) => Promise<void>
> = {
	async help(i) {
		await reply(i, await helpEmbed(i.client));
	},

	async rules(i) {
		await reply(i, await rulesEmbed(i.client));
	},

	async wordle(i) {
		await getGame(i.user.id).wordle(i);
	},

	async guess(i) {
		await getGame(i.user.id).guess(i);
	},

	async quit(i) {
		await getGame(i.user.id).quit(i);
		games.delete(i.user.id);
	},

	stats: sendGeneralStats,
	history: sendHistory
};

client.on("interactionCreate", async i => {
	if (i.isSelectMenu()) return await sendSpecificStats(i);
	if (i.isButton()) return await sendHistoryPage(i);

	if (!i.isChatInputCommand()) return;

	await commands[i.commandName]?.(i);
});

await client.login(isDev ? process.env.TOKEN_DEV : process.env.TOKEN);
