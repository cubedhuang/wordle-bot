import "dotenv/config";

import { Client, Intents, Message, MessageEmbed } from "discord.js";
import { inspect } from "node:util";

import { Constants } from "./constants";
import { words } from "./wordle";

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

client.on("messageCreate", async message => {
	if (message.author.bot) return;

	if (!message.content.startsWith(Constants.prefix)) return;

	const { name } = getCommand(message.content);

	switch (name) {
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

async function reply(message: Message, content: string | MessageEmbed) {
	if (typeof content === "string") {
		await message.reply({
			embeds: [{ color: Constants.embedColor, description: content }]
		});
	} else {
		await message.reply({ embeds: [content] });
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

function buildEmbed(target: string, guesses: string[], firstTime: boolean) {
	const grid =
		buildGrid(target, guesses) +
		"⬛⬛⬛⬛⬛ `-----`\n".repeat(6 - guesses.length).trim();

	return new MessageEmbed()
		.setTitle("Wordle " + target)
		.setColor(Constants.embedColor)
		.setDescription(
			firstTime
				? `Use \`${Constants.prefix}guess\` to guess a word or \`${Constants.prefix}quit\` to stop playing.\n\n${grid}`
				: grid
		);
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

	const target =
		words.answers[Math.floor(Math.random() * words.answers.length)];
	const guesses: string[] = [];
	let currentMessage = message;
	let repeatEmbed = true;

	while (guesses.length < 6 && guesses.at(-1) !== target) {
		if (repeatEmbed) {
			const embed = buildEmbed(target, guesses, guesses.length === 0);
			await reply(currentMessage, embed);
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
			await reply(message, "Stopped the current game.");
			return;
		}

		if (
			!guess ||
			guess.length !== 5 ||
			(!words.answers.includes(guess) &&
				!words.dictionary.includes(guess))
		) {
			await reply(guessMessage, "Invalid guess!");
			continue;
		}

		guesses.push(guess);
		repeatEmbed = true;
	}

	playingUsers.delete(message.author.id);

	const didWin = guesses.at(-1) === target;
	await reply(
		message,
		`
You ${guesses.at(-1) === target ? "win!" : "lost..."} The word was ${target}.

Wordle Bot ${didWin ? guesses.length : "X"}/6

${buildGrid(target, guesses, false)}
`.trim()
	);
}

await client.login(process.env.TOKEN);
