import { GlobalFonts } from "@napi-rs/canvas";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

GlobalFonts.registerFromPath(
	join(__dirname, "..", "fonts", "ClearSans-Bold.ttf"),
	"Clear Sans"
);
GlobalFonts.registerFromPath(
	join(__dirname, "..", "fonts", "ClearSans-Regular.ttf"),
	"Clear Sans"
);
GlobalFonts.registerFromPath(
	join(__dirname, "..", "fonts", "FiraMono-Bold.ttf"),
	"Fira Mono"
);

export * from "./game";
export * from "./stats";
export * from "./statsGuesses";
