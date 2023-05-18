import { words } from "./words.js";

const set = new Set([...words.answers, ...words.dictionary]);

export function isValidWord(word: string) {
	return word.length === 5 && set.has(word.toLowerCase());
}

export function getRandomAnswer() {
	return words.answers[Math.floor(Math.random() * words.answers.length)];
}
