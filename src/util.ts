export function range(length: number): Iterable<number>;
export function range(start: number, end: number): Iterable<number>;
export function range(start: number, end?: number): Iterable<number> {
	if (!end) {
		end = start;
		start = 0;
	}

	return {
		[Symbol.iterator]: function* () {
			for (let i = start; i < end!; i++) {
				yield i;
			}
		}
	};
}
