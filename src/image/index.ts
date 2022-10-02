import { GlobalFonts } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";

GlobalFonts.register(await readFile("./fonts/ClearSans-Bold.ttf"));
GlobalFonts.register(await readFile("./fonts/ClearSans-Regular.ttf"));
GlobalFonts.register(await readFile("./fonts/FiraMono-Bold.ttf"));

export * from "./game";
export * from "./stats";
export * from "./statsGuesses";
