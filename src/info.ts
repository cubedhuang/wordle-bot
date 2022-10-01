import { EmbedBuilder } from "discord.js";

export const helpEmbed = new EmbedBuilder()
	.setTitle("Wordle Bot")
	.setDescription(
		"Wordle is a simple bot that lets you play Wordle in your Discord server!"
	)
	.addFields({
		name: "Commands",
		value: `
\`/help\`: Shows this message.
\`/rules\`: Sends the rules of the game.
\`/wordle\`: Start a game of Wordle! Wordle games are currently per-user, and multiple people can play a game in a channel at once. If you're already in a game, this will resend the current game state.
\`/guess\`: Guess a word in your current Wordle game.
\`/quit\`: Stop your current Wordle game.
\`/stats\`: Display statistics for your past Wordle games.
`.trim()
	});

export const rulesEmbed = new EmbedBuilder()
	.setTitle("How to Play")
	.setDescription(
		`
Guess the **Wordle** in six tries! The word will be randomly chosen from the offical Wordle answer list at the start of each game.

Each guess must be a valid five-letter word. Use \`/guess\` to submit.

After each guess, the color of the tiles will show how close your guess was to the word.

🟩: The letter is in the word and in the correct position.
🟨: The letter is in the word but in the wrong position.
⬛: The letter is not in the word.

If a letter appears more than once in the guess but only once in the word, only one of the two tiles will be yellow or green. If a letter appears twice in both the guess and the word, both tiles will be yellow or green depending on their position.
`.trim()
	);
