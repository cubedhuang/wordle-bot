import "dotenv/config";

import {
	Client,
	CommandInteraction,
	Interaction,
	Message,
	MessageAttachment,
	MessageEmbed
} from "discord.js";
import { inspect } from "node:util";

import { Constants } from "./constants";
import { buildImage } from "./image";
import { range } from "./util";
import { getRandomWordleAnswer, isWordleWord } from "./wordle";

process.on("uncaughtException", err => {
	console.error("Uncaught", err);
});
process.on("unhandledRejection", err => {
	console.error("Unhandled", err);
});

const client = new Client({
	intents: ["DIRECT_MESSAGES", "GUILDS", "GUILD_MESSAGES"],
	allowedMentions: {
		parse: ["users", "roles"],
		repliedUser: false
	}
});

const playingUsers = new Set<string>();

client.on("ready", client => {
	console.log(`Logged in as ${client.user.tag}!`);

	function setStatus() {
		client.user.setActivity("/wordle", { type: "PLAYING" });
	}

	setStatus();
	setInterval(setStatus, 1000 * 60 * 30);
});

const helpEmbed = new MessageEmbed()
	.setTitle("Wordle Bot")
	.setDescription(
		"Wordle is a simple bot that lets you play Wordle in your Discord server!"
	)
	.addField(
		"Commands",
		`
\`/help\`: Shows this message.
\`/rules\`: Sends the rules of the game.
\`/wordle\`: Start a game of Wordle! Wordle games are currently per-user, and multiple people can play a game in a channel at once.
\`/guess\`: Guess a word in your current Wordle game.
\`/quit\`: Stop your current Wordle game.
`.trim()
	);

const rulesEmbed = new MessageEmbed().setTitle("How to Play").setDescription(
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

client.on("messageCreate", async message => {
	if (
		message.author.id !== process.env.OWNER_ID ||
		!message.content.startsWith("-eval")
	) {
		return;
	}

	const code = message.content.slice(5);

	try {
		const result = eval(code);
		await reply(message, `\`\`\`js\n${inspect(result)}\n\`\`\``);
	} catch (e) {
		await reply(message, `\`\`\`js\n${inspect(e)}\n\`\`\``);
	}
});

client.on("interactionCreate", async i => {
	if (!i.isCommand()) return;

	switch (i.commandName) {
		case "help":
			await reply(i, helpEmbed);
			break;
		case "rules":
			await reply(i, rulesEmbed);
			break;
		case "wordle":
			await startGame(i);
			break;
		case "guess":
		case "quit":
			if (!playingUsers.has(i.user.id)) {
				await reply(
					i,
					"You're not currently in a game! Use `/wordle` to start one."
				);
			}
			break;
	}
});

async function reply(
	receiver: Message | CommandInteraction,
	content: string
): Promise<Message>;
async function reply(
	receiver: Message | CommandInteraction,
	embed: MessageEmbed,
	file?: MessageAttachment
): Promise<Message>;
async function reply(
	receiver: Message | CommandInteraction,
	content: string | MessageEmbed,
	file?: MessageAttachment
) {
	if (typeof content === "string") {
		return await receiver.reply({
			embeds: [{ color: Constants.embedColor, description: content }]
		});
	} else {
		return await receiver.reply({
			embeds: [content.setColor(Constants.embedColor)],
			files: file ? [file] : undefined
		});
	}
}

function buildRow(target: string, guess: string) {
	const row: string[] = [];
	let remaining = target;

	for (const i of range(target.length)) {
		if (guess[i] === target[i]) {
			remaining = remaining.replace(guess[i], "");
			row.push("🟩");
		} else {
			row.push("⬛");
		}
	}

	for (const i of range(target.length)) {
		if (remaining.includes(guess[i]) && guess[i] !== target[i]) {
			remaining = remaining.replace(guess[i], "");
			row[i] = "🟨";
		}
	}

	return row.join("");
}

function buildGrid(target: string, guesses: string[]) {
	return guesses.map(guess => buildRow(target, guess)).join("\n");
}

function buildEmbed(firstTime: boolean) {
	const embed = new MessageEmbed()
		.setTitle("Wordle")
		.setImage("attachment://wordle.png");

	if (firstTime) {
		embed.setDescription(
			"Use `/guess` to guess a word or `/quit` to stop playing."
		);
	}

	return embed;
}

function nextGuess(userId: string) {
	return new Promise<CommandInteraction>(resolve => {
		const callback = (i: Interaction) => {
			if (
				i.isCommand() &&
				i.user.id === userId &&
				["guess", "quit"].includes(i.commandName)
			) {
				client.removeListener("messageCreate", callback);
				resolve(i);
			}
		};

		client.on("interactionCreate", callback);
	});
}

async function startGame(i: CommandInteraction) {
	if (playingUsers.has(i.user.id)) {
		await reply(
			i,
			"You're already playing a game! Use `/quit` to stop playing your current game."
		);
		return;
	}

	playingUsers.add(i.user.id);

	const target = getRandomWordleAnswer();
	const guesses: string[] = [];
	let currentI = i;
	let repeatEmbed = true;

	console.log(`User started. | ${playingUsers.size} playing.`);

	while (guesses.length < 6 && guesses.at(-1) !== target) {
		if (repeatEmbed) {
			const embed = buildEmbed(guesses.length === 0);
			await reply(
				currentI,
				embed,
				new MessageAttachment(buildImage(target, guesses), "wordle.png")
			);
			repeatEmbed = false;
		}

		const guessI = await nextGuess(i.user.id);

		if (guessI.commandName === "quit") {
			playingUsers.delete(i.user.id);
			await reply(
				guessI,
				`Stopped the current game. The word was **${target}**.`
			);

			console.log(`User quit.    | ${playingUsers.size} playing.`);

			return;
		}

		const guess = guessI.options.getString("guess", true);

		if (guess.length !== 5) {
			await reply(guessI, "Guesses must be 5 letters long!");
			continue;
		}

		if (!isWordleWord(guess)) {
			await reply(guessI, "That's not a valid Wordle word!");
			continue;
		}

		currentI.deleteReply();
		currentI = guessI;

		guesses.push(guess.toLowerCase());
		repeatEmbed = true;
	}

	playingUsers.delete(i.user.id);

	const didWin = guesses.at(-1) === target;

	const embed = new MessageEmbed()
		.setTitle(didWin ? "You won!" : "You lost...")
		.setDescription(
			`
The word was **${target}**.

Wordle Bot ${didWin ? guesses.length : "X"}/6

${buildGrid(target, guesses)}
`.trim()
		)
		.setImage("attachment://wordle.png");
	const image = new MessageAttachment(
		buildImage(target, guesses),
		"wordle.png"
	);

	await reply(currentI, embed, image);

	console.log(
		`User had ${didWin ? guesses.length : "X"}/6. | ${
			playingUsers.size
		} playing.`
	);
}

await client.login(
	process.argv.includes("dev") ? process.env.TOKEN_DEV : process.env.TOKEN
);
