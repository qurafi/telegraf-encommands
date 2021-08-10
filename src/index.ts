import { parseArgs } from "./args";
import { Command, CommandHandler, Commands, constructorConfigs } from "./types";
import { createMiddleware } from "./middleware";

// Default options
const DEFAULTS: constructorConfigs = {
	cacheStore: new Map(),
	replyCacheAge: 86400, // ONE DAY
	defaults: {
		required: false,
		parser: parseArgs,
		mode: "both",
		allowEdited: true,
		useRepliedTo: false,
		deleteOldReplies: true,
		largeResponseCache: true,
		minResponseSize: 10,
	},
};

export function TelegrafEncommands(_configs: Partial<constructorConfigs>) {
	const configs = { ...DEFAULTS, ..._configs };
	configs.defaults = { ...DEFAULTS.defaults, ...configs };
	const commands: Commands = new Map();

	function create(command: string, options?: Command) {
		if (!options?.handler) {
			throw new Error("command handler is missing");
		}

		commands.set(command, { ...configs.defaults, ...options });
	}

	return {
		configs,
		middleware: createMiddleware(configs, commands),
		create,
		on(command: string, handler: CommandHandler) {
			create(command, { handler });
		},
	};
}
