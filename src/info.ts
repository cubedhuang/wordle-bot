import { Client, EmbedBuilder } from "discord.js";

import { command } from "./util.js";

export const helpEmbed = async (c: Client) =>
	new EmbedBuilder()
		.setTitle("Wordle Bot")
		.setDescription(
			`
Wordle is a simple bot that lets you play Wordle in your Discord server!

Games are currently per-user, and multiple people can play a game in a channel at once. If you're already in a game, this will resend the current game state.

Wordle Bot is open source! You can find the source code [here](https://github.com/cubedhuang/wordle-bot).
We also have a [Terms of Service](https://gist.github.com/cubedhuang/2def1df2c9f1759bb8ec7c5084328618) and [Privacy Policy](https://gist.github.com/cubedhuang/c443f9b3692a4bd32b1bac6d566313b6).

If you have any questions, suggestions, or bug reports, please join our [support server](https://discord.gg/H4bndawejj)!
`.trim()
		)
		.addFields({
			name: "Commands",
			value: `
${await command(c, "help")}: Shows this message.
${await command(c, "rules")}: Sends the rules of the game.

${await command(c, "wordle")}: Start a game of Wordle!
${await command(c, "guess")}: Guess a word in your current Wordle game.
${await command(c, "quit")}: Stop your current Wordle game.

${await command(c, "stats")}: Display statistics for your past Wordle games.
${await command(c, "history")}: Browse through your past games.
`.trim()
		});

export const rulesEmbed = async (c: Client) =>
	new EmbedBuilder().setTitle("How to Play").setDescription(
		`
Guess the **Wordle** in six tries! The word will be randomly chosen from the offical Wordle answer list at the start of each game.

Each guess must be a valid five-letter word. Use ${await command(
			c,
			"guess"
		)} to submit.

After each guess, the color of the tiles will show how close your guess was to the word.

🟩: The letter is in the word and in the correct position.
🟨: The letter is in the word but in the wrong position.
⬛: The letter is not in the word.

If a letter appears more than once in the guess but only once in the word, only one of the two tiles will be yellow or green. If a letter appears twice in both the guess and the word, both tiles will be yellow or green depending on their position.
`.trim()
	);
