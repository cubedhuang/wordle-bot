import "dotenv/config";

import { ShardingManager } from "discord.js";

import { db } from "./db.js";
import { isDev } from "./util.js";

const manager = new ShardingManager("build/src/bot.js", {
	shardArgs: process.argv.slice(2),
	token: isDev ? process.env.TOKEN_DEV : process.env.TOKEN
});

manager.on("shardCreate", shard => console.log(`Launched shard ${shard.id}.`));

manager.spawn();

setInterval(async () => {
	await Promise.all([
		db.$queryRaw`REFRESH MATERIALIZED VIEW "GlobalTopFirstGuesses";`,
		db.$queryRaw`REFRESH MATERIALIZED VIEW "GlobalTopGuesses";`,
		db.$queryRaw`REFRESH MATERIALIZED VIEW "GlobalUniqueGuessesCount";`
	]);

	console.log("Refreshed materialized views.");
}, 1000 * 60 * 60);
