import { parseArgs, parserOptions } from "./args";
import { Telegraf } from "telegraf";
import * as TT from "telegram-typings";

const supportedUpdateSubTypes = ["text", "audio", "voice", "video", "photo", "document", "sticker"];

type CommandHandler = (arg: object) => Promise<TT.Message> | void | undefined | false;

// Available command options
interface CommandConfigs {
	// only run this command if args are specified
	required?: boolean;

	// only works if required is set to true
	helpMessage?: string;

	// set your custom parser function
	// this is called with (query, parserArgOptions)
	// the default parser in args.ts
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

	// use replied_to_message if exists as query
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
	private botReplies = new Map();
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
			}

			let entity = entities && entities[0];
			let isCommand = entity && entity.type == "bot_command" && entity.offset === 0;
			if (!isCommand) return next();

			let command = text.slice(1, entity.length);
			let query = text.slice(entity.length + 1);

			let cmd = this.commands[command];

			if (!cmd) return next();
			if (cmd.allowEdited === false && isEdited) return next();

			let botReplyMID = this.botReplies.get(message_id);
			if (cmd.deleteOldReplies && isEdited && botReplyMID) {
				ctx.deleteMessage(botReplyMID);
				this.botReplies.delete(message_id);
			}

			if (cmd.subTypes && !cmd.subTypes.some(v => v == subType)) return next();

			let chatType = message?.chat?.id > 0 ? "private" : "group";
			if (cmd.mode != chatType && cmd.mode !== "both") {
				return next();
			}

			let allowedUsers = cmd.allowedUsers;

			if (allowedUsers && !allowedUsers.some(v => v === user)) {
				return next();
			}

			if (query.trim() === "" && cmd.useReply && reply) {
				let { text } = this.getMessageText(reply);
				if (text && text.trim() !== "") {
					query = text;
				}
			}

			if (query?.trim() === "" && cmd.required) {
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

			let returned = cmd.handler(params);
			if (returned instanceof Promise) {
				returned.then(v => {
					if (cmd.deleteOldReplies && v?.message_id) {
						this.botReplies.set(message_id, v.message_id);
					}
				});
			} else if (returned === false) {
				return next();
			}
		});
	}

	create(command: string, options?: Command) {
		this.commands[command] = Object.assign({}, this._configs, options);
		return this.commands[command];
	}

	on(command: string, handler: CommandHandler) {
		return this.create(command, { handler });
	}
}

module.exports = CommandManager;
