import "dotenv/config";

import { ChatInputCommandInteraction, Client, Collection } from "discord.js";

import { Game } from "./Game.js";
import { helpEmbed, rulesEmbed } from "./info.js";
import { sendHistory, sendHistoryPage } from "./sendHistory.js";
import { sendGeneralStats, sendSpecificStats } from "./sendStats.js";
import { isDev, reply } from "./util.js";

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
		activities: [{ name: "/wordle" }]
	}
});

const games = new Collection<string, Game>();

function getGame(id: string) {
	return games.get(id) ?? games.set(id, new Game()).get(id)!;
}

client.on("ready", client => {
	console.log(`Logged in as ${client.user.tag}!`);

	setInterval(() => {
		client.user.setActivity("/wordle");
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
	if (i.isStringSelectMenu()) return await sendSpecificStats(i);
	if (i.isButton()) return await sendHistoryPage(i);

	if (!i.isChatInputCommand()) return;

	await commands[i.commandName]?.(i);
});

await client.login(isDev ? process.env.TOKEN_DEV : process.env.TOKEN);
