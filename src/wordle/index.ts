import { words } from "./words";

const set = new Set([...words.answers, ...words.dictionary]);

export function isWordleWord(word: string) {
	return word.length === 5 && set.has(word.toLowerCase());
}

export function getRandomWordleAnswer() {
	return words.answers[Math.floor(Math.random() * words.answers.length)];
}
