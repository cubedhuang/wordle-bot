import { Canvas } from "@napi-rs/canvas";

import { range } from "../util.js";
import { DARK_GRAY, FONT_FAMILY, GRAY, GREEN } from "./constants.js";

const canvas = new Canvas(500, 300);
const ctx = canvas.getContext("2d");

ctx.fillStyle = DARK_GRAY;
ctx.fillRect(0, 0, canvas.width, canvas.height);

interface BuildStatsData {
	started: number;
	wins: number;
	losses: number;
	quits: number;
	streak: number;
	maxStreak: number;
	dist: number[];
}

export function buildStatsImage(data: BuildStatsData) {
	ctx.fillStyle = DARK_GRAY;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Distance from the center of the first stat to the vertical center.
	const statOffset = 200;

	renderStat(data.started, "Games\nStarted", canvas.width / 2 - statOffset);
	renderStat(
		data.wins,
		"Games\nWon",
		canvas.width / 2 - (statOffset * 3) / 5
	);
	renderStat(data.losses, "Games\nLost", canvas.width / 2 - statOffset / 5);
	renderStat(data.quits, "Games\nQuit", canvas.width / 2 + statOffset / 5);
	renderStat(
		data.streak,
		"Current\nStreak",
		canvas.width / 2 + (statOffset * 3) / 5
	);
	renderStat(data.maxStreak, "Max\nStreak", canvas.width / 2 + statOffset);

	ctx.font = `bold 16px ${FONT_FAMILY}`;
	ctx.fillText("GUESS DISTRIBUTION", canvas.width / 2, 125);

	// Distance from edge of bars to the vertical center.
	const barOffset = 200;
	// Space reserved for the bar labels
	const labelSpace = 12;

	const bars = data.dist;
	const max = Math.max(...bars);
	const scale = (barOffset * 2 - labelSpace) / max;

	for (const i of range(bars.length)) {
		const y = 150 + i * 22;

		ctx.fillStyle = bars[i] === 0 ? GRAY : GREEN;
		ctx.fillRect(
			canvas.width / 2 - barOffset + labelSpace,
			y,
			Math.max(bars[i] * scale, 30),
			18
		);

		ctx.fillStyle = "white";
		ctx.textAlign = "left";
		ctx.font = `bold 12px ${FONT_FAMILY}`;
		ctx.fillText(`${i + 1}`, canvas.width / 2 - barOffset, y + 2);

		ctx.textAlign = "right";
		ctx.fillText(
			`${bars[i]}`,
			Math.max(
				canvas.width / 2 - barOffset + labelSpace + bars[i] * scale - 8,
				canvas.width / 2 - barOffset + labelSpace + 22
			),
			y + 2
		);
	}

	return canvas.toBuffer("image/webp");
}

function renderStat(value: number, label: string, x: number) {
	ctx.textBaseline = "top";
	ctx.textAlign = "center";
	ctx.fillStyle = "white";

	ctx.font = `bold 36px ${FONT_FAMILY}`;
	ctx.fillText(`${value}`, x, 20);

	ctx.font = `normal 12px ${FONT_FAMILY}`;
	let y = 60;
	for (const row of label.split("\n")) {
		ctx.fillText(row, x, y);
		y += 15;
	}
}
