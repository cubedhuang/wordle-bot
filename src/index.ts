import "dotenv/config";

import {
	Client,
	Intents,
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
	intents: Object.values(Intents.FLAGS),
	allowedMentions: {
		parse: ["users", "roles"],
		repliedUser: false
	}
});

const playingUsers = new Set<string>();

client.on("ready", client => {
	console.log(`Logged in as ${client.user.tag}!`);

	function setStatus() {
		client.user.setActivity(`${Constants.prefix}wordle`, {
			type: "PLAYING"
		});
	}

	setStatus();
	setInterval(setStatus, 1000 * 60 * 30);
});

function getCommand(content: string) {
	if (!content.startsWith(Constants.prefix))
		return { name: "", raw: "", args: [] };

	const sliced = content.slice(Constants.prefix.length).trim();
	const [name] = sliced.split(/\s+/, 1);
	const raw = sliced.slice(name.length).trim();

	return {
		name,
		raw,
		get args() {
			return raw.split(/\s+/);
		}
	};
}

const helpEmbed = new MessageEmbed()
	.setTitle("Wordle Bot")
	.setDescription(
		"Wordle is a simple bot that lets you play Wordle in your Discord server!"
	)
	.addField(
		"Commands",
		`
\`${Constants.prefix}help\`: Shows this message.
\`${Constants.prefix}rules\`: Sends the rules of the game.
\`${Constants.prefix}wordle\`: Start a game of Wordle! Wordle games are currently per-user, and multiple people can play a game in a channel at once.
\`${Constants.prefix}guess\`: Guess a word in your current Wordle game.
\`${Constants.prefix}quit\`: Stop your current Wordle game.
`.trim()
	);

const rulesEmbed = new MessageEmbed().setTitle("How to Play").setDescription(
	`
Guess the **Wordle** in six tries! The word will be randomly chosen from the offical Wordle answer list at the start of each game.

Each guess must be a valid five-letter word. Use \`${Constants.prefix}guess\` to submit.

After each guess, the color of the tiles will show how close your guess was to the word.

🟩: The letter is in the word and in the correct position.
🟨: The letter is in the word but in the wrong position.
⬛: The letter is not in the word.

If a letter appears more than once in the guess but only once in the word, only one of the two tiles will be yellow or green. If a letter appears twice in both the guess and the word, both tiles will be yellow or green depending on their position.
`.trim()
);

client.on("messageCreate", async message => {
	if (message.author.bot) return;

	if (!message.content.startsWith(Constants.prefix)) return;

	const { name, raw } = getCommand(message.content);

	switch (name) {
		case "help":
			await reply(message, helpEmbed);
			break;
		case "rules":
			await reply(message, rulesEmbed);
			break;
		case "wordle":
			await startGame(message);
			break;
		case "guess":
		case "quit":
			if (!playingUsers.has(message.author.id)) {
				await reply(message, "You're not currently in a game!");
			}
			break;
		case "eval":
			if (message.author.id !== process.env.OWNER_ID) break;
			try {
				const result = eval(raw);
				await reply(message, `\`\`\`js\n${inspect(result)}\n\`\`\``);
			} catch (e) {
				await reply(message, `\`\`\`js\n${inspect(e)}\n\`\`\``);
			}
	}
});

async function reply(message: Message, content: string): Promise<Message>;
async function reply(
	message: Message,
	embed: MessageEmbed,
	file?: MessageAttachment
): Promise<Message>;
async function reply(
	message: Message,
	content: string | MessageEmbed,
	file?: MessageAttachment
) {
	if (typeof content === "string") {
		return await message.reply({
			embeds: [{ color: Constants.embedColor, description: content }]
		});
	} else {
		return await message.reply({
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

function buildGrid(target: string, guesses: string[], displayWords = true) {
	let grid = "";

	for (const guess of guesses) {
		grid += buildRow(target, guess);

		if (displayWords) {
			grid += ` \`${guess}\``;
		}

		grid += `\n`;
	}

	return grid;
}

function buildEmbed(firstTime: boolean) {
	const embed = new MessageEmbed()
		.setTitle("Wordle")
		.setImage("attachment://wordle.png");

	if (firstTime) {
		embed.setDescription(
			`Use \`${Constants.prefix}guess\` to guess a word or \`${Constants.prefix}quit\` to stop playing.`
		);
	}

	return embed;
}

function nextGuess(message: Message) {
	return new Promise<Message>(resolve => {
		const callback = (m: Message) => {
			if (
				m.author.id === message.author.id &&
				["guess", "quit"].includes(getCommand(m.content).name)
			) {
				client.removeListener("messageCreate", callback);
				resolve(m);
			}
		};

		client.on("messageCreate", callback);
	});
}

async function startGame(message: Message) {
	if (playingUsers.has(message.author.id)) {
		await reply(
			message,
			`You're already playing a game! Use \`${Constants.prefix}quit\` to stop playing your current game.`
		);
		return;
	}

	playingUsers.add(message.author.id);

	const target = getRandomWordleAnswer();
	const guesses: string[] = [];
	let currentMessage = message;
	let repeatEmbed = true;

	while (guesses.length < 6 && guesses.at(-1) !== target) {
		if (repeatEmbed) {
			const embed = buildEmbed(guesses.length === 0);
			await reply(
				currentMessage,
				embed,
				new MessageAttachment(buildImage(target, guesses), "wordle.png")
			);
			repeatEmbed = false;
		}

		const guessMessage = await nextGuess(message);
		currentMessage = guessMessage;

		const {
			name,
			args: [guess]
		} = getCommand(guessMessage.content);

		if (name === "quit") {
			playingUsers.delete(message.author.id);
			await reply(
				message,
				`Stopped the current game. The word was **${target}**.`
			);
			return;
		}

		if (!guess) {
			await reply(guessMessage, "Enter a word to guess!");
			continue;
		}

		if (guess.length !== 5) {
			await reply(guessMessage, "Guesses must be 5 letters long!");
			continue;
		}

		if (!isWordleWord(guess)) {
			await reply(guessMessage, "That's not a valid Wordle word!");
			continue;
		}

		guesses.push(guess.toLowerCase());
		repeatEmbed = true;
	}

	playingUsers.delete(message.author.id);

	const didWin = guesses.at(-1) === target;

	const embed = new MessageEmbed()
		.setTitle(didWin ? "You won!" : "You lost...")
		.setDescription(
			`
The word was **${target}**.

Wordle Bot ${didWin ? guesses.length : "X"}/6

${buildGrid(target, guesses, false)}
`.trim()
		)
		.setImage("attachment://wordle.png");
	const image = new MessageAttachment(
		buildImage(target, guesses),
		"wordle.png"
	);

	await reply(message, embed, image);
}

await client.login(process.env.TOKEN);
