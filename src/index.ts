import { parseArgs } from "./args";
import { Command, CommandHandler, Commands, constructorConfigs } from "./types";
import { createMiddleware } from "./middleware";
import {InvalidCommand} from "./middleware"

// Default options
const DEFAULTS: constructorConfigs = {
	cacheStore: new Map(),
	replyCacheAge: 86400, // ONE DAY

	// default options for any command
	defaults: {
		required: false,
		parser: parseArgs,
		mode: "both",
		allowEdited: true,
		useRepliedTo: false,
		largeResponseCache: true,
		minResponseSize: 128,
	},
};

export function TelegrafEncommands(_configs: Partial<constructorConfigs>) {
	const commands: Commands = new Map();
	const configs = { ...DEFAULTS, ..._configs };
	configs.defaults = { ...DEFAULTS.defaults, ...configs };

	function create(command: string, options?: Command) {
		if (!options?.handler) {
			throw new Error("command handler is missing");
		}

		commands.set(command, { ...configs.defaults, ...options });
	}

	return {
		configs,
		create,
		middleware: createMiddleware(configs, commands),
		on(command: string, handler: CommandHandler) {
			create(command, { handler });
		},
	};
}

TelegrafEncommands.InvalidCommand = InvalidCommand
export {InvalidCommand}