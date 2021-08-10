import { parseArgs, parserOptions } from "./args";
import * as TT from "telegram-typings";
import { Context } from "telegraf";
import { TelegrafEncommands } from ".";

export interface Store {
	set(key: string, value: any): any;
	get(key: string): any;
	delete(key: string): any;
}

export const supportedUpdateSubTypes = <const>[
	"text",
	"audio",
	"voice",
	"video",
	"photo",
	"document",
	"sticker",
];

export type UpdateSubType = typeof supportedUpdateSubTypes[number];

// Available command options
export interface CommandConfigs {
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
	subTypes?: UpdateSubType[];

	// allow edited message with command to run
	allowEdited?: boolean;

	// use replied_to_message if exists as query
	// only works if:
	//	- the replied to message is text
	//	- original message query is empty
	useRepliedTo?: boolean;

	// Delete old bot replies
	deleteOldReplies?: boolean;

	// useful for if you want to respond with a large message. to avoid distracting chat use this
	// it will store the message id and then when user send the same command it'll we'll reply to this cached message
	largeResponseCache?: boolean;

	// specify the minimum length to cache large messages
	minResponseSize?: number;
}

export interface constructorConfigs {
	/**
	 * Specify custom store for caching
	 *
	 * Should implement Map methods like set, get, and delete
	 *
	 * default is a Map object(in memory)
	 */
	cacheStore: Store;

	/** Specify cache reply age in seconds */
	replyCacheAge: number;

	/** Specify the defaults for commands */
	defaults: CommandConfigs;
}

export interface CommandParams<C extends Context = Context> {
	/** context object of telegraf*/
	ctx: C;

	/** command name */
	command: string;

	/** raw query string */
	query: string;

	/** parsed args if exists */
	args: string[] | undefined;

	/** contains message object */
	message: TT.Message;

	/** is the command is a reply to other message */
	isReply: boolean;

	/** reply to message object if exists  */
	reply_to?: TT.Message;

	isEdited: boolean;

	/**
	 * Message type.
	 * for example, photo, video, or files/documents
	 * */
	type: UpdateSubType;

	// {
	// 	text?: string;
	// 	entities?: TT.MessageEntity[];
	// }

	/**
	 * Message data related to the type of the message for example img will return images links and dimensions and files will return file urls, etc.
	 */
	data: Record<string, any>;
}

type MaybePromise<T> = Promise<T> | T;
// export type CommandParams = Record<string, any>
export type CommandHandler = (
	arg: CommandParams
) => MaybePromise<TT.Message | void | undefined | false>;
export type Command = CommandConfigs & { handler: CommandHandler };
export type Commands = Map<string, Command>;
export type CommandsInstance = ReturnType<typeof TelegrafEncommands>;
