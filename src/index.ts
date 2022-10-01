import "dotenv/config";

import {
	ActivityType,
	ChatInputCommandInteraction,
	Client,
	Collection
} from "discord.js";

import { Game } from "./Game";
import { helpEmbed, rulesEmbed } from "./info";
import { sendStats } from "./sendStats";
import { reply } from "./util";

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
		await reply(i, helpEmbed);
	},

	async rules(i) {
		await reply(i, rulesEmbed);
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

	async stats(i) {
		await sendStats(i);
	}
};

client.on("interactionCreate", async i => {
	if (!i.isChatInputCommand()) return;

	await commands[i.commandName]?.(i);
});

await client.login(
	process.argv.includes("dev") ? process.env.TOKEN_DEV : process.env.TOKEN
);
