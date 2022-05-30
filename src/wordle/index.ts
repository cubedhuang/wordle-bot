import { words } from "./words";

class TrieNode {
	children?: Record<string, TrieNode>;

	add(word: string) {
		if (word.length === 0) return;
		this.children ??= {};
		this.children[word[0]] ??= new TrieNode();
		this.children[word[0]].add(word.slice(1));
	}

	has(word: string): boolean {
		if (word.length === 0) return true;
		if (!this.children?.[word[0]]) return false;
		return this.children[word[0]].has(word.slice(1));
	}
}

const root = new TrieNode();

const start = process.hrtime.bigint();
for (const word of words.answers) root.add(word);
for (const word of words.dictionary) root.add(word);
const end = process.hrtime.bigint();

console.log(`Built Wordle trie in ${Number(end - start) / 1e6}ms.`);

export function isWordleWord(word: string) {
	return word.length === 5 && root.has(word.toLowerCase());
}

export function getRandomWordleAnswer() {
	return words.answers[Math.floor(Math.random() * words.answers.length)];
}
