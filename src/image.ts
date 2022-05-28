import { Canvas } from "@napi-rs/canvas";

const GREEN = "#5c8d4d";
const YELLOW = "#b19f3b";
const GRAY = "#3a3a3c";
const DARK_GRAY = "#121213";
const LIGHT_GRAY = "#818384";

const keys = [
	["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l"],
	["z", "x", "c", "v", "b", "n", "m"]
];

const keyIndices: Record<string, [number, number]> = {};
for (let i = 0; i < keys.length; i++) {
	for (let j = 0; j < keys[i].length; j++) {
		keyIndices[keys[i][j]] = [i, j];
	}
}

const canvas = new Canvas(350, 560);
const ctx = canvas.getContext("2d");

ctx.textBaseline = "middle";
ctx.textAlign = "center";

export function buildImage(target: string, guesses: string[]) {
	ctx.fillStyle = DARK_GRAY;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.font = "bold 32px Calibri";

	const keyColors = keys.map(row => row.map(_ => LIGHT_GRAY));

	for (let i = 0; i < guesses.length; i++) {
		const guess = guesses[i];
		const row: string[] = [];
		let remaining = target;

		for (let j = 0; j < target.length; j++) {
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

		for (let j = 0; j < target.length; j++) {
			if (remaining.includes(guess[j]) && guess[j] !== target[j]) {
				remaining = remaining.replace(guess[j], "");
				row[j] = YELLOW;

				const [a, b] = keyIndices[guess[j]];
				if (keyColors[a][b] !== GREEN) {
					keyColors[a][b] = YELLOW;
				}
			}
		}

		for (let j = 0; j < guesses[i].length; j++) {
			ctx.fillStyle = row[j];
			ctx.fillRect(j * 67 + 10, i * 67 + 10, 62, 62);
			ctx.fillStyle = "white";
			ctx.fillText(
				guesses[i][j].toUpperCase(),
				j * 67 + 10 + 62 / 2,
				i * 67 + 10 + 62 / 2
			);
		}
	}

	ctx.strokeStyle = "#3a3a3c";
	ctx.lineWidth = 2;

	for (let i = guesses.length; i < 6; i++) {
		for (let j = 0; j < 5; j++) {
			ctx.strokeRect(j * 67 + 10 + 1, i * 67 + 10 + 1, 62 - 1, 62 - 1);
		}
	}

	ctx.font = "bold 18px Calibri";

	for (let i = 0; i < keys.length; i++) {
		const startX = i === 0 ? 5 : i === 1 ? 20 : 55;
		const startY = 410;
		for (let j = 0; j < keys[i].length; j++) {
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

	return canvas.toBuffer("image/png");
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
	ctx.arc(x + w - r, y + r, r, (Math.PI * 3) / 2, 0);
	ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
	ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
	ctx.closePath();
	ctx.fill();
}
