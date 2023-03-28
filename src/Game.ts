import { GameResult } from "@prisma/client";
import {
	AttachmentBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder
} from "discord.js";

import { db } from "./db.js";
import { getUser } from "./dbUtils.js";
import { buildGameImage } from "./image/game.js";
import { command, range, reply } from "./util.js";
import { isWordleWord } from "./wordle/index.js";

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

function simpleEmbed() {
	return new EmbedBuilder()
		.setTitle("Wordle")
		.setImage("attachment://wordle.webp");
}

export class Game {
	current: ChatInputCommandInteraction | null = null;

	async wordle(i: ChatInputCommandInteraction) {
		this.current = i;

		const user = await getUser(BigInt(i.user.id));

		await reply(
			i,
			simpleEmbed().setDescription(
				`Use ${await command(
					i.client,
					"guess"
				)} to guess a word or ${await command(
					i.client,
					"quit"
				)} to stop playing.${
					user.activeGame!.guesses.length
						? "\n\nYou were already in the middle of a Wordle game:"
						: ""
				}`
			),
			{
				files: [
					new AttachmentBuilder(
						buildGameImage(
							user.activeGame!.target,
							user.activeGame!.guesses!.map(g => g.guess)
						)
					).setName("wordle.webp")
				]
			}
		);
	}

	async guess(i: ChatInputCommandInteraction) {
		const id = BigInt(i.user.id);
		const user = await getUser(id);
		const game = user.activeGame!;

		const guess = i.options.getString("guess", true);

		if (guess.length !== 5) {
			await reply(i, "Guesses must be 5 letters long!", {
				ephemeral: true
			});
			return;
		}

		if (!isWordleWord(guess)) {
			await reply(i, "That's not a valid Wordle word!", {
				ephemeral: true
			});
			return;
		}

		this.current?.deleteReply();
		this.current = i;

		await db.guess.create({
			data: {
				gameId: game.id,
				guess
			}
		});

		const guesses = game.guesses!.map(g => g.guess);
		guesses.push(guess);

		const image = new AttachmentBuilder(
			buildGameImage(game.target, guesses)
		).setName("wordle.webp");

		if (
			// Win condition
			guess === game.target ||
			// Lose condition
			game.guesses!.length === 5
		) {
			const win = guess === game.target;

			const embed = new EmbedBuilder()
				.setTitle(win ? "You won!" : "You lost...")
				.setDescription(
					`
The word was **${game.target}**.

Wordle Bot ${win ? guesses.length : "X"}/6

${buildGrid(game.target, guesses)}
			`.trim()
				)
				.setImage("attachment://wordle.webp");

			await reply(this.current, embed, {
				files: [image]
			});

			await this.done(id, win ? "WIN" : "LOSS");

			return;
		}

		await reply(this.current, simpleEmbed(), {
			files: [image]
		});
	}

	async quit(i: ChatInputCommandInteraction) {
		const id = BigInt(i.user.id);
		const user = await db.user.findUnique({
			where: { id },
			include: { activeGame: true }
		});

		if (!user?.activeGame) {
			await reply(
				i,
				`You're not currently in a game! Use ${await command(
					i.client,
					"wordle"
				)} to start one.`,
				{
					ephemeral: true
				}
			);

			return;
		}

		await reply(
			i,
			`Stopped the current game. The word was **${
				user.activeGame!.target
			}**.`
		);

		await this.done(id, "QUIT");
	}

	async done(id: bigint, result: GameResult) {
		await db.game.update({
			where: { activeUserId: id },
			data: {
				activeUserId: null,
				endTime: new Date(),
				result
			}
		});
	}
}
