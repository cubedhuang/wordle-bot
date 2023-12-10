import "dotenv/config";

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { SlashCommandBuilder } from "discord.js";

const isDev = process.argv.includes("dev");

console.log(
	`Registering ${isDev ? "development" : "production"} interactions...`
);

const token = isDev ? process.env.TOKEN_DEV : process.env.TOKEN;

const applicationId = isDev ? "847923734438608916" : "979977332645302272";
const guildId = "979976981850497074";

const commands = [
	new SlashCommandBuilder()
		.setName("help")
		.setDescription("Display information about the bot."),
	new SlashCommandBuilder()
		.setName("rules")
		.setDescription("Get the rules for Guess the Word."),
	new SlashCommandBuilder()
		.setName("play")
		.setDescription("Start a round of Guess the Word!"),
	new SlashCommandBuilder()
		.setName("guess")
		.setDescription("Guess a word in your current game.")
		.addStringOption(option =>
			option
				.setName("guess")
				.setDescription("The guess to make in your current game.")
				.setRequired(true)
		),
	new SlashCommandBuilder()
		.setName("quit")
		.setDescription("Quit your current game."),
	new SlashCommandBuilder()
		.setName("stats")
		.setDescription("Display statistics about your past games.")
		.addUserOption(option =>
			option
				.setName("user")
				.setDescription("The user to display statistics for.")
		),
	new SlashCommandBuilder()
		.setName("history")
		.setDescription("Browse through your past games.")
];

for (const command of commands) {
	// @ts-expect-error
	command.contexts = [0, 1, 2];
	// @ts-expect-error
	command.integration_types = [0, 1];
}

const rest = new REST().setToken(token!);

await rest.patch("/applications/@me", {
	body: {
		integration_types: [0, 1]
	}
});

console.log("Started refreshing interactions.");

const route = isDev
	? Routes.applicationGuildCommands(applicationId, guildId)
	: Routes.applicationCommands(applicationId);

await rest.put(route, { body: commands });

console.log("Successfully reloaded interactions.");
