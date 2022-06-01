import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import {
	Client,
	CommandInteraction,
	Interaction,
	InteractionReplyOptions,
	MessageAttachment,
	MessageEmbed
} from "discord.js";
import { inspect } from "node:util";

import { buildGameImage, buildStatsImage } from "./image";
import { range } from "./util";
import { getRandomWordleAnswer, isWordleWord } from "./wordle";

process.on("uncaughtException", err => {
	console.error("Uncaught", err);
});
process.on("unhandledRejection", err => {
	console.error("Unhandled", err);
});

const prisma = new PrismaClient();

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

	let result: string;
	try {
		result = inspect(eval(code));
	} catch (e) {
		result = inspect(e);
	}
	result = `\`\`\`js\n${result.slice(0, 2000)}\n\`\`\``;

	await message.reply({
		embeds: [{ description: result }]
	});
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
		case "stats":
			await sendStats(i);
	}
});

async function reply(
	i: CommandInteraction,
	content: string | MessageEmbed,
	options?: InteractionReplyOptions
) {
	if (typeof content === "string") {
		return await i.reply({
			embeds: [{ color: "#56a754", description: content }],
			...options
		});
	} else {
		return await i.reply({
			embeds: [content.setColor("#56a754")],
			...options
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

	await prisma.user.upsert({
		where: { userId: i.user.id },
		create: { userId: i.user.id, started: 1 },
		update: { started: { increment: 1 } }
	});

	const target = getRandomWordleAnswer();
	const guesses: string[] = [];
	let currentI = i;
	let repeatEmbed = true;

	console.log(`User started. | ${playingUsers.size} playing.`);

	while (guesses.length < 6 && guesses.at(-1) !== target) {
		if (repeatEmbed) {
			const embed = buildEmbed(guesses.length === 0);
			await reply(currentI, embed, {
				files: [
					new MessageAttachment(
						buildGameImage(target, guesses),
						"wordle.png"
					)
				]
			});
			repeatEmbed = false;
		}

		const guessI = await nextGuess(i.user.id);

		if (guessI.commandName === "quit") {
			playingUsers.delete(i.user.id);
			await reply(
				guessI,
				`Stopped the current game. The word was **${target}**.`
			);

			await prisma.user.update({
				where: { userId: i.user.id },
				data: { quits: { increment: 1 } }
			});

			console.log(`User quit.    | ${playingUsers.size} playing.`);
			return;
		}

		const guess = guessI.options.getString("guess", true);

		if (guess.length !== 5) {
			await reply(guessI, "Guesses must be 5 letters long!", {
				ephemeral: true
			});
			continue;
		}

		if (!isWordleWord(guess)) {
			await reply(guessI, "That's not a valid Wordle word!", {
				ephemeral: true
			});
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

	await reply(currentI, embed, {
		files: [
			new MessageAttachment(buildGameImage(target, guesses), "wordle.png")
		]
	});

	if (didWin) {
		const user = await prisma.user.findUnique({
			where: { userId: i.user.id }
		});

		await prisma.user.update({
			where: { userId: i.user.id },
			data: {
				wins: { increment: 1 },
				[`wins${guesses.length}` as "wins1"]: { increment: 1 },
				streak: { increment: 1 },
				maxStreak: Math.max(user!.maxStreak, user!.streak)
			}
		});
	} else {
		await prisma.user.update({
			where: { userId: i.user.id },
			data: { losses: { increment: 1 }, streak: 0 }
		});
	}

	console.log(
		`User had ${didWin ? guesses.length : "X"}/6. | ${
			playingUsers.size
		} playing.`
	);
}

async function sendStats(i: CommandInteraction) {
	const user = await prisma.user.findUnique({
		where: { userId: i.user.id }
	});

	if (!user) {
		await reply(i, "You haven't played any games yet!", {
			ephemeral: true
		});
		return;
	}

	const embed = new MessageEmbed()
		.setTitle("Wordle Stats")
		.setImage("attachment://stats.png");

	const image = buildStatsImage({
		...user,
		dist: [
			user.wins1,
			user.wins2,
			user.wins3,
			user.wins4,
			user.wins5,
			user.wins6
		]
	});

	await reply(i, embed, {
		files: [new MessageAttachment(image, "stats.png")]
	});
}

await client.login(
	process.argv.includes("dev") ? process.env.TOKEN_DEV : process.env.TOKEN
);
