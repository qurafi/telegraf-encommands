import { parseArgs, parserOptions } from "./args";
import { Telegraf } from "telegraf";
import * as TT from "telegram-typings";
import d from "debug";

const debug = d("telegraf:encommands");
const supportedUpdateSubTypes = ["text", "audio", "voice", "video", "photo", "document", "sticker"];

type CommandHandler = (arg: object) => Promise<TT.Message> | void | undefined | false;

// Available command options
interface CommandConfigs {
	// only run this command if args are specified
	required?: boolean;

	// help message when user send command without args
	// only works if required is set to true
	helpMessage?: string;

	// set your custom parser function
	// this is called with (query, parserArgOptions)
	// the default parser is in args.ts file
	parser?: Function;
	parserOptions?: parserOptions;

	// allowed users to run this command
	allowedUsers?: string[];

	// target chat type, default is both
	mode?: "private" | "group" | "both";

	// set command to only run on specific sub type
	// for example. run a command for photos only
	subTypes?: typeof supportedUpdateSubTypes[number][];

	// allow edited message with command to run
	allowEdited?: boolean;

	// use replied to message if exists as query of the commnad
	// only works if:
	//	- the replied to message is text
	//	- original message query is empty
	useReply?: boolean;

	// Delete old bot replies
	deleteOldReplies?: boolean;
}

// Default options
const DEFAULTS: CommandConfigs = {
	required: false,
	parser: parseArgs,
	mode: "private",
	allowEdited: true,
	useReply: true,
	deleteOldReplies: true,
};

interface Command extends CommandConfigs {
	// main callback for the command
	handler: CommandHandler;
}

interface Commands {
	[key: string]: Command;
}

export default class CommandManager {
	private _configs: CommandConfigs = { ...DEFAULTS };
	private botReplies: { [key: number]: number } = {};
	private readonly commands: Commands = {};
	static readonly parseArgs = parseArgs;

	set configs(v) {
		this._configs = Object.assign({}, DEFAULTS, v);
	}

	get configs() {
		return this._configs;
	}

	private getMessageSubType(message: any) {
		return supportedUpdateSubTypes.find(v => message && v in message);
	}

	private getMessageText(message: any) {
		let subType = this.getMessageSubType(message);
		let isText = subType == "text";
		return {
			text: message[isText ? "text" : "caption"],
			entities: message[isText ? "entities" : "caption_entities"],
		};
	}

	get middleware() {
		// Composer.entity does not work
		return Telegraf.mount(["edited_message", "message"], (ctx, next) => {
			debug("\nnew message");
			let message = ctx.editedMessage ?? ctx.message;
			if (!message) return next();

			//	ctx.updateSubTypes is broken on edited messages
			let subType = this.getMessageSubType(message);
			if (!subType) return next();

			let { message_id, reply_to_message: reply } = message;
			let { text, entities } = this.getMessageText(message);
			let updateData = { text, entities };
			let isEdited = !!ctx.editedMessage;
			let user = message?.from?.username;
			let replySubType = this.getMessageSubType(reply);

			if (!text || !entities) return next();

			if (subType && subType !== "text") {
				let info = message[subType];
				updateData = { ...updateData, ...info };

				debug(message);

				if (info) {
					debug({ [subType]: message[subType] });
				}
			}

			debug({ subType, isEdited, text });

			let entity = entities && entities[0];
			let isCommand = entity && entity.type == "bot_command" && entity.offset === 0;
			debug({ isCommand });
			if (!isCommand) return next();

			debug("command detected");

			let command = text.slice(1, entity.length);
			let query = text.slice(entity.length + 1);

			let cmd = this.commands[command];
			debug(cmd);

			if (!cmd) return next();
			if (cmd.allowEdited === false && isEdited) return next();

			let botReplyMID = this.botReplies[message_id];
			if (cmd.deleteOldReplies && isEdited && botReplyMID) {
				ctx.deleteMessage(botReplyMID);
				delete this.botReplies[message_id];
			}

			if (cmd.subTypes && !cmd.subTypes.some(v => v == subType)) return next();

			let chatType = message?.chat?.id > 0 ? "private" : "group";
			if (cmd.mode != chatType && cmd.mode !== "both") {
				debug(`/${command}: this command doesn't work on ${chatType} chat`);
				return next();
			}

			let allowedUsers = cmd.allowedUsers;
			debug({ allowedUsers, user });

			if (allowedUsers && !allowedUsers.some(v => v === user)) {
				debug(`/${command}: permissions denied for user @${user}`);
				return next();
			}

			debug({ reply });
			if (query.trim() === "" && cmd.useReply && reply) {
				let { text } = this.getMessageText(reply);
				if (text && text.trim() !== "") {
					query = text;
				}

				debug({ text });
			}

			if (query?.trim() === "" && cmd.required) {
				debug("cmd.required, print help or return next()");

				if (cmd.helpMessage) {
					return ctx.replyWithMarkdown(cmd.helpMessage);
				}

				return next();
			}

			let args;
			if (cmd.parser && typeof query === "string") {
				args = cmd.parser(query, cmd.parserOptions);
			}

			let params = {
				ctx, // telegraf context object
				command, // command name
				query, // raw query
				args, // parsed arguments if exists
				message, // the message object from context object
				reply, // message object of reply message
				replySubType, // reply message type
				isReply: !!reply,
				isEdited,

				// related to the type of message and its data
				// for example : type: photo, data: {file_id:...}
				updateType: subType,
				updateData,
			};

			debug({ params });

			let returned = cmd.handler(params);
			if (returned instanceof Promise) {
				returned.then(v => {
					if (cmd.deleteOldReplies && v.message_id) {
						this.botReplies[message_id] = v.message_id;

						debug("bot reply has been cached");
					}
				});
			} else if (returned === false) {
				return next();
			}
		});
	}

	create(command: string, options?: Command) {
		this.commands[command] = Object.assign({}, this._configs, options);
		debug({ command: this.commands[command] });
		return this.commands[command];
	}

	on(command: string, handler: CommandHandler) {
		return this.create(command, { handler });
	}
}

module.exports = CommandManager;
