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
	if (!content.startsWith(Constants.prefix)) return { name: "", args: [] };

	const [name, ...args] = content
		.slice(Constants.prefix.length)
		.trim()
		.split(/\s+/);

	return { name, args };
}

const helpEmbed = new MessageEmbed()
	.setColor(Constants.embedColor)
	.setTitle("Wordle Bot")
	.setDescription(
		"Wordle is a simple bot that lets you play Wordle in your Discord server!"
	)
	.addField(
		"Commands",
		`
\`${Constants.prefix}help\`: Shows this message.
\`${Constants.prefix}wordle\`: Start a game of Wordle! Wordle games are currently per-user, and multiple people can play a game in a channel at once.
\`${Constants.prefix}guess\`: Guess a word in your current Wordle game.
\`${Constants.prefix}quit\`: Stop your current Wordle game.
`.trim()
	);

client.on("messageCreate", async message => {
	if (message.author.bot) return;

	if (!message.content.startsWith(Constants.prefix)) return;

	const { name } = getCommand(message.content);

	switch (name) {
		case "help":
			await reply(message, helpEmbed);
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
				const result = eval(
					message.content.slice(
						Constants.prefix.length + "eval ".length
					)
				);
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
			embeds: [content],
			files: file ? [file] : undefined
		});
	}
}

function buildRow(target: string, guess: string) {
	let row: string[] = [];
	let remaining = target;

	for (let i = 0; i < target.length; i++) {
		if (guess[i] === target[i]) {
			remaining = remaining.replace(guess[i], "");
			row.push("🟩");
		} else {
			row.push("⬛");
		}
	}

	for (let i = 0; i < target.length; i++) {
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
		.setColor(Constants.embedColor)
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
				`Stopped the current game. The word was ${target}.`
			);
			return;
		}

		if (!guess || !isWordleWord(guess)) {
			await reply(guessMessage, "Invalid guess!");
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
The word was ${target}.

Wordle Bot ${didWin ? guesses.length : "X"}/6

${buildGrid(target, guesses, false)}
`.trim()
		)
		.setImage("attachment://wordle.png")
		.setColor(Constants.embedColor);
	const image = new MessageAttachment(
		buildImage(target, guesses),
		"wordle.png"
	);

	await reply(message, embed, image);
}

await client.login(process.env.TOKEN);
