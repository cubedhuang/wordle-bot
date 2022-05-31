import { words } from "./words";

interface TrieNode {
	[key: string]: TrieNode;
}

function trieInsert(node: TrieNode, word: string) {
	if (word.length === 0) return;
	node[word[0]] ??= {};
	trieInsert(node[word[0]], word.slice(1));
}

function trieHas(node: TrieNode, word: string): boolean {
	if (word.length === 0) return true;
	if (!node[word[0]]) return false;
	return trieHas(node[word[0]], word.slice(1));
}

function trieCount(node: TrieNode): number {
	if (Object.keys(node).length === 0) return 1;
	return Object.values(node).reduce((acc, node) => acc + trieCount(node), 0);
}

const root: TrieNode = {};

const start = process.hrtime.bigint();
for (const word of words.answers) trieInsert(root, word);
for (const word of words.dictionary) trieInsert(root, word);
const end = process.hrtime.bigint();

console.log(`Built Wordle trie in ${Number(end - start) / 1e6}ms.`);
console.log(
	`${trieCount(root)} words in trie. ${words.answers.length} answers + ${
		words.dictionary.length
	} dictionary = ${words.answers.length + words.dictionary.length} total.`
);

export function isWordleWord(word: string) {
	return word.length === 5 && trieHas(root, word.toLowerCase());
}

export function getRandomWordleAnswer() {
	return words.answers[Math.floor(Math.random() * words.answers.length)];
}
