import { GlobalFonts } from "@napi-rs/canvas";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

GlobalFonts.registerFromPath(
	join(__dirname, "..", "fonts", "ClearSans-Bold.ttf"),
	"ClearSans"
);
GlobalFonts.registerFromPath(
	join(__dirname, "..", "fonts", "ClearSans-Regular.ttf"),
	"ClearSans"
);

export * from "./game";
export * from "./stats";
