import "dotenv/config";

import { Client, Intents, Message, MessageEmbed } from "discord.js";

import { words } from "./wordle";

const CONSTANTS = {
	embedColor: "#56a754"
} as const;

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
		client.user.setActivity(`-wordle`, { type: "PLAYING" });
	}

	setStatus();
	setInterval(setStatus, 1000 * 60 * 30);
});

client.on("messageCreate", async message => {
	if (message.content.match(/^-wordle\b/)) {
		await startGame(message);
	} else if (
		message.content.match(/^-guess\b/) &&
		!playingUsers.has(message.author.id)
	) {
		await reply(message, "You're not currently in a game!");
	}
});

async function reply(message: Message, content: string | MessageEmbed) {
	if (typeof content === "string") {
		await message.reply({
			embeds: [{ color: CONSTANTS.embedColor, description: content }]
		});
	} else {
		await message.reply({ embeds: [content] });
	}
}

function buildGrid(target: string, guesses: string[], displayWords = true) {
	let grid = "";

	for (const guess of guesses) {
		for (let i = 0; i < guess.length; i++) {
			if (target[i] === guess[i]) {
				grid += `🟩`;
			} else if (target.includes(guess[i])) {
				grid += `🟨`;
			} else {
				grid += `⬛`;
			}
		}

		if (displayWords) {
			grid += ` \`${guess}\``;
		}

		grid += `\n`;
	}

	return grid;
}

function buildEmbed(target: string, guesses: string[]) {
	let grid = buildGrid(target, guesses);

	for (let i = 0; i < 6 - guesses.length; i++) {
		grid += "⬛⬛⬛⬛⬛ `-----`\n";
	}

	return new MessageEmbed()
		.setTitle("Wordle")
		.setColor(CONSTANTS.embedColor)
		.setDescription(`Use \`-guess\` to guess a word.\n\n${grid}`);
}

function nextGuess(message: Message) {
	return new Promise<Message>(resolve => {
		const callback = (m: Message) => {
			if (
				m.author.id === message.author.id &&
				!!m.content.match(/^-guess\b/)
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
		await reply(message, "You're already playing a game!");
		return;
	}

	playingUsers.add(message.author.id);

	const target =
		words.answers[Math.floor(Math.random() * words.answers.length)];
	const guesses: string[] = [];
	let repeatEmbed = true;

	while (guesses.length < 6 && guesses.at(-1) !== target) {
		if (repeatEmbed) {
			const embed = buildEmbed(target, guesses);
			await reply(message, embed);
			repeatEmbed = false;
		}

		const guessMessage = await nextGuess(message);
		const match = guessMessage.content.match(/^-guess\s+(.{5})$/);

		if (!match) {
			await reply(guessMessage, "Invalid guess!");
			continue;
		}

		const guess = match[1];

		if (
			!words.answers.includes(guess) &&
			!words.dictionary.includes(guess)
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
You ${guesses.at(-1) === target ? "win!" : "lost..."} The word was ${target}!

Wordle Bot ${didWin ? guesses.length : "X"}/6

${buildGrid(target, guesses, false)}
`
	);
}

client.login(process.env.TOKEN);
