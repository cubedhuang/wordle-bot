import { Canvas, Image } from "@napi-rs/canvas";

import { GREEN } from "./constants";

const canvas = new Canvas(400, 300);
const ctx = canvas.getContext("2d");

interface StatsGuessesData {
	top: [string, number][];
	total: number;
	unique: number;
	perGame: number;
	perWin: number;
}

const MAX_BAR_WIDTH = 240;
const MIN_BAR_WIDTH = 28;
const BAR_END = 336;

const createSvg = (data: StatsGuessesData) => `
<svg width="400" height="300" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
	<rect width="400" height="300" fill="#121213" />

	<g fill="white" font-family="Clear Sans">
		<text font-size="32" font-weight="bold" x="12" y="46">
			${data.total}
		</text>
		<text font-size="12">
			<tspan x="12" y="62">Total</tspan>
			<tspan x="12" dy="12">Guesses</tspan>
		</text>

		<text font-size="32" font-weight="bold" x="12" y="114">
			${data.unique}
		</text>
		<text font-size="12">
			<tspan x="12" y="130">Unique</tspan>
			<tspan x="12" dy="12">Guesses</tspan>
		</text>

		<text font-size="32" font-weight="bold" x="12" y="182">
			${data.perGame.toFixed(2)}
		</text>
		<text font-size="12">
			<tspan x="12" y="198">Guesses</tspan>
			<tspan x="12" dy="12">Per Game</tspan>
		</text>

		<text font-size="32" font-weight="bold" x="12" y="250">
			${data.perWin.toFixed(2)}
		</text>
		<text font-size="12">
			<tspan x="12" y="266">Guesses</tspan>
			<tspan x="12" dy="12">Per Win</tspan>
		</text>

		<text font-size="24" font-weight="bold" x="388" y="36" text-anchor="end">Most Used Guesses</text>

		${data.top
			.map(([word, count], i) => {
				const barWidth = Math.max(
					(count / data.top[0][1]) * MAX_BAR_WIDTH,
					MIN_BAR_WIDTH
				);

				return `
					<text
						font-family="Fira Mono"
						font-size="16"
						font-weight="bold"
						x="388"
						y="${63 + i * 24}"
						text-anchor="end"
					>
						${word}</text>
					<rect
						x="${BAR_END - barWidth}"
						y="${48 + i * 24}"
						width="${barWidth}"
						height="18"
						fill="${GREEN}"
					/>
					<text
						font-size="14"
						font-weight="bold"
						x="${BAR_END - barWidth + 6}"
						y="${62 + i * 24}"
					>
						${count}
					</text>`;
			})
			.join("")}
	</g>
</svg>`;

export function buildStatsGuessesImage(data: StatsGuessesData) {
	const svg = new Image(400, 300);
	svg.src = Buffer.from(createSvg(data), "utf8");
	ctx.drawImage(svg, 0, 0);

	return canvas.toBuffer("image/webp");
}
