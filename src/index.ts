import { parseArgs, parserOptions } from "./args";
import Telegraf from "telegraf";
import * as TT from "telegram-typings";
import { IncomingMessage } from "telegraf/typings/telegram-types";
import { TelegrafContext } from "telegraf/typings/context";
import { MiddlewareFn } from "telegraf/typings/composer";

const supportedUpdateSubTypes = ["text", "audio", "voice", "video", "photo", "document", "sticker"];

type Store = Map<string, string | string[]>;
type obj = Record<string, unknown>;

type CommandHandler = (arg: obj) => Promise<TT.Message> | void | undefined | false;

// Available command options
interface CommandConfigs {
	// only run this command if args are specified
	required?: boolean;

	// only works if required is set to true
	helpMessage?: string;

	// set your custom parser function
	// this is called with (query, parserArgOptions)
	// the default parser in args.ts
	parser?: typeof parseArgs;
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

	// useful for if you want to respond with a large message. to avoid distracting chat use this
	// it will store the message id and then when user send the same command it'll we'll reply to this cached message
	largeResponseCache?: boolean;

	// specify the minimum length to cache large messages
	minResponseSize?: number;
}

interface constructorConfigs extends CommandConfigs {
	// specfiy custom store for caching message ids
	// the default one is Map
	// you should add your custom store with set and get method
	cacheStore?: Store;

	// specify cache reply age
	// in seconds
	replyCacheAge?: number;
}

// Default options
const DEFAULTS: CommandConfigs = {
	required: false,
	parser: parseArgs,
	mode: "both",
	allowEdited: true,
	useReply: true,
	deleteOldReplies: true,
	largeResponseCache: true,
	minResponseSize: 10,
};

interface Command extends CommandConfigs {
	// main callback for the command
	handler: CommandHandler;
}

interface Commands {
	[key: string]: Command;
}

export default class CommandManager {
	static readonly parseArgs = parseArgs;
	private _configs: CommandConfigs = { ...DEFAULTS };
	private readonly commands: Commands = {};
	public cacheStore = new Map();
	public replyCacheAge: number;

	constructor(configs: constructorConfigs = {}) {
		this.configs = configs;

		if (configs.cacheStore) this.cacheStore = configs.cacheStore;
		this.replyCacheAge = configs.replyCacheAge || 86400;
	}

	get middleware(): MiddlewareFn<TelegrafContext> {
		// Composer.entity does not work
		return Telegraf.mount(["edited_message", "message"], async (ctx, next) => {
			const message = ctx.editedMessage ?? ctx.message;
			if (!message) return next();

			//	ctx.updateSubTypes is broken on edited messages
			const subType = this.getMessageSubType(message);
			if (!subType) return next();

			const { message_id, reply_to_message: reply } = message;
			const { text, entities } = this.getMessageText(message);
			const isEdited = !!ctx.editedMessage;
			const user = message?.from?.username;
			let updateData: obj = { text, entities };
			let replySubType;
			if (reply) replySubType = this.getMessageSubType(reply);

			if (!text || !entities) return next();

			if (subType && subType !== "text") {
				const info = message[subType];
				if (info) updateData = { ...updateData, ...info };
			}

			const entity = entities && entities[0];
			const isCommand = entity && entity.type == "bot_command" && entity.offset === 0;
			if (!isCommand) return next();

			const command = text.slice(1, entity.length);
			let query = text.slice(entity.length + 1);

			const cmd = this.commands[command];

			if (!cmd) return next();
			if (cmd.allowEdited === false && isEdited) return next();

			const botReplies = this.cacheStore;

			if (botReplies && cmd.deleteOldReplies && isEdited) {
				const key = `id-${message_id}`;
				const botReplyMID = await botReplies.get(key);

				if (botReplyMID) {
					ctx.deleteMessage(botReplyMID);
					botReplies.delete(key);
				}
			}

			if (cmd.subTypes && !cmd.subTypes.some(v => v == subType)) return next();

			const chatType = message?.chat?.id > 0 ? "private" : "group";
			if (cmd.mode != chatType && cmd.mode !== "both") {
				return next();
			}

			const allowedUsers = cmd.allowedUsers;
			if (allowedUsers && !allowedUsers.some(v => v === user)) {
				return next();
			}

			if (query.trim() === "" && cmd.useReply && reply) {
				const { text } = this.getMessageText(reply);
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

			let args: string[] | undefined;
			if (cmd.parser && typeof query === "string") {
				args = cmd.parser(query, cmd.parserOptions);
			}

			const replyKey = `query-${args ? args.join() : query}`;
			const mid = await botReplies.get(replyKey);

			let botReply;
			let replyToCachedMessage = mid && cmd.largeResponseCache;
			if (replyToCachedMessage) {
				try {
					botReply = await ctx.replyWithMarkdown("`  👆`", {
						reply_to_message_id: mid,
					});

					const dnow = Date.now() / 1000;
					const dmsg = botReply.reply_to_message?.date;

					if (dmsg && dnow - dmsg > this.replyCacheAge) {
						ctx.deleteMessage(botReply.message_id);
						await botReplies.delete(replyKey);
						replyToCachedMessage = false;
					}
				} catch (e) {
					replyToCachedMessage = false;
				}
			}

			if (!replyToCachedMessage) {
				const params = {
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

				botReply = await cmd.handler(params);
			}

			if (botReply && botReply.message_id) {
				const mid = botReply.message_id.toString();

				if (cmd.deleteOldReplies) {
					await botReplies.set(`id-${message_id}`, mid);
				}

				const min = cmd.minResponseSize || 200;
				const text = botReply.text;
				if (cmd.largeResponseCache && text && text.length >= min) {
					const query_id = args ? args.join() : query;
					await botReplies.set(`query-${query_id}`, mid);
				}
			}

			if (botReply === false) return next();
		});
	}

	create(command: string, options?: Command): Command {
		this.commands[command] = Object.assign({}, this._configs, options);
		return this.commands[command];
	}

	on(command: string, handler: CommandHandler): Command {
		return this.create(command, { handler });
	}

	get configs(): CommandConfigs {
		return this._configs;
	}

	set configs(v: CommandConfigs) {
		this._configs = Object.assign({}, DEFAULTS, v);
	}

	private getMessageSubType(message: IncomingMessage) {
		return supportedUpdateSubTypes.find(v => message && v in message);
	}

	private getMessageText(message: IncomingMessage) {
		const subType = this.getMessageSubType(message);
		const isText = subType == "text";
		return {
			text: message[isText ? "text" : "caption"],
			entities: message[isText ? "entities" : "caption_entities"],
		};
	}
}

module.exports = CommandManager;
