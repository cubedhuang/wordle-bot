import { Canvas, Image } from "@napi-rs/canvas";

import { FONT_FAMILY, FONT_FAMILY_MONO, GREEN } from "./constants";

const IMAGE_SCALE = 5;

const MAX_BAR_WIDTH = 180;
const MIN_BAR_WIDTH = 28;
const BAR_END = 352;
const TOP_TOTAL_START = 30;
const TOP_START_START = 170;

const canvas = new Canvas(400 * IMAGE_SCALE, 300 * IMAGE_SCALE);
const ctx = canvas.getContext("2d");
const svg = new Image(400 * IMAGE_SCALE, 300 * IMAGE_SCALE);

interface StatsGuessesData {
	topTotal: [string, number][];
	topFirst: [string, number][];
	total: number;
	unique: number;
	perGame: number;
	perWin: number;
}

const createSvg = (data: StatsGuessesData) => `
<svg width="400" height="300" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
	<rect width="400" height="300" fill="#121213" />

	<g fill="white" font-family="${FONT_FAMILY}">
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

		<text font-size="14" font-weight="bold" x="388" y="${TOP_TOTAL_START}" text-anchor="end">Most Used Guesses</text>

		${data.topTotal
			.map(([word, count], i) => {
				const barWidth = Math.max(
					(count / data.topTotal[0][1]) * MAX_BAR_WIDTH,
					MIN_BAR_WIDTH
				);

				return `
					<text
						font-family="${FONT_FAMILY_MONO}"
						font-size="10"
						font-weight="bold"
						x="388"
						y="${TOP_TOTAL_START + 15 + i * 11}"
						text-anchor="end"
					>
						${word}</text>
					<rect
						x="${BAR_END - barWidth}"
						y="${TOP_TOTAL_START + 6 + i * 11}"
						width="${barWidth}"
						height="10"
						fill="${GREEN}"
					/>
					<text
						font-size="8"
						font-weight="bold"
						x="${BAR_END - barWidth + 4}"
						y="${TOP_TOTAL_START + 14 + i * 11}"
					>
						${count}
					</text>`;
			})
			.join("")}

		<text font-size="14" font-weight="bold" x="388" y="${TOP_START_START}" text-anchor="end">Most Used Starting Words</text>

		${data.topFirst
			.map(([word, count], i) => {
				const barWidth = Math.max(
					(count / data.topFirst[0][1]) * MAX_BAR_WIDTH,
					MIN_BAR_WIDTH
				);

				return `
					<text
						font-family="${FONT_FAMILY_MONO}"
						font-size="10"
						font-weight="bold"
						x="388"
						y="${TOP_START_START + 15 + i * 11}"
						text-anchor="end"
					>
						${word}</text>
					<rect
						x="${BAR_END - barWidth}"
						y="${TOP_START_START + 6 + i * 11}"
						width="${barWidth}"
						height="10"
						fill="${GREEN}"
					/>
					<text
						font-size="8"
						font-weight="bold"
						x="${BAR_END - barWidth + 4}"
						y="${TOP_START_START + 14 + i * 11}"
					>
						${count}
					</text>`;
			})
			.join("")}
	</g>
</svg>`;

export function buildStatsGuessesImage(data: StatsGuessesData) {
	svg.src = Buffer.from(createSvg(data), "utf8");
	ctx.drawImage(svg, 0, 0, 400 * IMAGE_SCALE, 300 * IMAGE_SCALE);

	return canvas.toBuffer("image/webp");
}
