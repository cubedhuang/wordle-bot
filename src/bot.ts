import "dotenv/config";

import { CaptureConsole } from "@sentry/integrations";
import * as Sentry from "@sentry/node";
import {
	ButtonInteraction,
	ChatInputCommandInteraction,
	Client,
	Collection,
	EmbedBuilder,
	Events,
	GatewayIntentBits,
	StringSelectMenuInteraction,
	WebhookClient
} from "discord.js";
import { inspect } from "node:util";

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

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment: isDev ? "development" : "production",
	integrations: [new CaptureConsole({ levels: ["warn", "error"] })],
	tracesSampleRate: 1.0
});

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
	allowedMentions: {
		parse: ["users"],
		repliedUser: false
	},
	presence: {
		activities: [{ name: "/play" }]
	}
});

const webhook = new WebhookClient({ url: process.env.WEBHOOK_URL! });

const games = new Collection<string, Game>();

function getGame(id: string) {
	return games.get(id) ?? games.set(id, new Game()).get(id)!;
}

client.on("ready", client => {
	console.log(`Logged in as ${client.user.tag}!`);

	setInterval(() => {
		client.user.setActivity("/play");
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

	async play(i) {
		await getGame(i.user.id).play(i);
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

function handleInteractionError(
	i:
		| ChatInputCommandInteraction
		| StringSelectMenuInteraction
		| ButtonInteraction,
	err: unknown
) {
	Sentry.captureException(err);

	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setTitle("Error")
				.setDescription(`\`\`\`js\n${inspect(err)}\n\`\`\``)
				.setFields(
					{
						name: "Command",
						value: i.toString(),
						inline: true
					},
					{
						name: "User",
						value: i.user.toString(),
						inline: true
					}
				)
				.setTimestamp()
		],
		username: client.user?.username,
		avatarURL: client.user?.displayAvatarURL(),
		allowedMentions: {}
	});

	if (i.replied || i.deferred) return;

	reply(i, "An error occurred. Please try again later.", {
		ephemeral: true
	});
}

client.on(Events.InteractionCreate, async i => {
	if (i.isStringSelectMenu()) {
		const transaction = Sentry.startTransaction({
			op: "select",
			name: `stats:${i.values[0]}`,
			data: { user: i.user.id }
		});

		await sendSpecificStats(i).catch(err => handleInteractionError(i, err));

		transaction.finish();

		return;
	}

	if (i.isButton()) {
		if (i.customId === "new") {
			const transaction = Sentry.startTransaction({
				op: "button",
				name: "new",
				data: { user: i.user.id }
			});

			await getGame(i.user.id)
				.play(i)
				.catch(err => {
					handleInteractionError(i, err);
				});

			transaction.finish();

			return;
		}

		const transaction = Sentry.startTransaction({
			op: "button",
			name: "history",
			data: { user: i.user.id, page: i.customId }
		});

		await sendHistoryPage(i).catch(err => handleInteractionError(i, err));

		transaction.finish();

		return;
	}

	if (!i.isChatInputCommand() || !commands[i.commandName]) return;

	const transaction = Sentry.startTransaction({
		op: "command",
		name: i.commandName,
		data: {
			user: i.user.id,
			args: i.options.data.map(o => `${o.name}: ${o.value}`)
		}
	});

	await commands[i.commandName](i).catch(err =>
		handleInteractionError(i, err)
	);

	transaction.finish();
});

await client.login(isDev ? process.env.TOKEN_DEV : process.env.TOKEN);
