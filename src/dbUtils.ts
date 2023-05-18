import { db } from "./db.js";
import { getRandomAnswer } from "./words/index.js";

export async function getUser(id: bigint) {
	const user = await db.user.upsert({
		where: { id },
		create: { id },
		update: {},
		include: { activeGame: { include: { guesses: true } } }
	});

	if (!user.activeGame) {
		await db.game.create({
			data: {
				target: getRandomAnswer(),
				userId: id,
				activeUserId: id
			},
			include: { guesses: true }
		});
	}

	return await db.user.findUniqueOrThrow({
		where: { id },
		include: { activeGame: { include: { guesses: true } } }
	});
}
