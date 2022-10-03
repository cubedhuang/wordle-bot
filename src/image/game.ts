import { Canvas, SKRSContext2D } from "@napi-rs/canvas";

import { range } from "../util";
import {
	DARK_GRAY,
	FONT_FAMILY,
	GRAY,
	GREEN,
	LIGHT_GRAY,
	YELLOW
} from "./constants";

const keys = [
	["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l"],
	["z", "x", "c", "v", "b", "n", "m"]
];

const keyIndices: Record<string, [number, number]> = {};
for (const i of range(keys.length)) {
	for (const j of range(keys[i].length)) {
		keyIndices[keys[i][j]] = [i, j];
	}
}

const fullCanvas = new Canvas(350, 560);
const fullCtx = fullCanvas.getContext("2d");

fullCtx.textBaseline = "middle";
fullCtx.textAlign = "center";

const shortCanvas = new Canvas(350, 418);
const shortCtx = shortCanvas.getContext("2d");

shortCtx.textBaseline = "middle";
shortCtx.textAlign = "center";

export function buildGameImage(
	target: string,
	guesses: string[],
	keyboard = true
) {
	const canvas = keyboard ? fullCanvas : shortCanvas;
	const ctx = keyboard ? fullCtx : shortCtx;

	const keyColors = drawGameGrid(canvas, ctx, target, guesses);

	if (keyboard) drawGameKeyboard(ctx, keyColors);

	return canvas.toBuffer("image/webp");
}

function drawGameGrid(
	canvas: Canvas,
	ctx: SKRSContext2D,
	target: string,
	guesses: string[]
) {
	ctx.fillStyle = DARK_GRAY;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.font = `bold 32px ${FONT_FAMILY}`;

	const keyColors = keys.map(row => row.map(_ => LIGHT_GRAY));

	for (const i of range(guesses.length)) {
		const guess = guesses[i];
		const row: string[] = [];
		let remaining = target;

		for (const j of range(target.length)) {
			if (guess[j] === target[j]) {
				remaining = remaining.replace(guess[j], "");
				row.push(GREEN);

				const [a, b] = keyIndices[guess[j]];
				keyColors[a][b] = GREEN;
			} else {
				row.push(GRAY);

				const [a, b] = keyIndices[guess[j]];
				if (keyColors[a][b] === LIGHT_GRAY) {
					keyColors[a][b] = GRAY;
				}
			}
		}

		for (const j of range(target.length)) {
			if (remaining.includes(guess[j]) && guess[j] !== target[j]) {
				remaining = remaining.replace(guess[j], "");
				row[j] = YELLOW;

				const [a, b] = keyIndices[guess[j]];
				if (keyColors[a][b] !== GREEN) {
					keyColors[a][b] = YELLOW;
				}
			}
		}

		for (const j of range(guess.length)) {
			ctx.fillStyle = row[j];
			ctx.fillRect(j * 67 + 10, i * 67 + 10, 62, 62);
			ctx.fillStyle = "white";
			ctx.fillText(
				guess[j].toUpperCase(),
				j * 67 + 10 + 62 / 2,
				i * 67 + 10 + 62 / 2
			);
		}
	}

	ctx.strokeStyle = GRAY;
	ctx.lineWidth = 2;

	for (const i of range(guesses.length, 6)) {
		for (const j of range(5)) {
			ctx.strokeRect(j * 67 + 10 + 1, i * 67 + 10 + 1, 62 - 1, 62 - 1);
		}
	}

	return keyColors;
}

function drawGameKeyboard(ctx: SKRSContext2D, keyColors: string[][]) {
	ctx.font = `bold 17px ${FONT_FAMILY}`;

	for (const i of range(keys.length)) {
		const startX = i === 0 ? 5 : i === 1 ? 20 : 55;
		const startY = 410;
		for (const j of range(keys[i].length)) {
			ctx.fillStyle = keyColors[i][j];
			roundRect(startX + j * 32 + 10, startY + i * 45 + 10, 30, 40, 5);
			ctx.fillStyle = "white";
			ctx.fillText(
				keys[i][j].toUpperCase(),
				startX + j * 32 + 10 + 15,
				startY + i * 45 + 10 + 20
			);
		}
	}
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
	fullCtx.beginPath();
	fullCtx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
	fullCtx.arc(x + w - r, y + r, r, (Math.PI * 3) / 2, 0);
	fullCtx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
	fullCtx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
	fullCtx.closePath();
	fullCtx.fill();
}
