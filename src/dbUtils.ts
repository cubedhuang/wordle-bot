import { db } from "./db";
import { getRandomWordleAnswer } from "./wordle";

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
				target: getRandomWordleAnswer(),
				userId: id,
				activeUserId: id,
				startTime: new Date()
			},
			include: { guesses: true }
		});
	}

	return await db.user.findUniqueOrThrow({
		where: { id },
		include: { activeGame: { include: { guesses: true } } }
	});
}
