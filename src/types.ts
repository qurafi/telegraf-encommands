import { parseArgs, parserOptions } from "./args";
import * as TT from "telegram-typings";
import { Context } from "telegraf";
import { TelegrafEncommands } from ".";

export interface Store {
	set(key: string, value: any): any;
	get(key: string): any;
	delete(key: string): any;
}

export const SUPPORTED_SUBTYPES = [
	"text",
	"audio",
	"voice",
	"video",
	"photo",
	"document",
	"sticker",
] as const;

export type UpdateSubType = typeof SUPPORTED_SUBTYPES[number];

export interface CommandConfigs {
	/** Run only when passing arguments */
	required?: boolean;

	/** Show help message when passing empty arguments. ONLY works if `required` option is set to true */
	helpMessage?: string;

	/**
     * Set your own custom arguments parser function
     * 
     * This is called with (query, parserArgOptions)
     * 
     * The default parser in args.ts
    */
	parser?: typeof parseArgs;
	parserOptions?: parserOptions;

	/** Allowed users to run this command */
	allowedUsers?: string[];

	/** Target chat type, default is both */
	mode?: "private" | "group" | "both";

	/** 
        Run this command only on specific sub type(e.g. photos only)
    */
	subTypes?: UpdateSubType[];

	/** Allow edited message to run commands */
	allowEdited?: boolean;

	/** 
     * Use replied_to_message if exists as command arguments
     * 
     * Only works if:
     * - The replied to message is text
     * - Original message arguments is empty
    */
	useRepliedTo?: boolean;

    /** 
     * Enable caching for large command results 
     * 
     * It will store the result `message_id` in the cache and then reply to it
     * 
     * Useful If you want less chat distracting
     * 
     * */
	// it will store the message id and then when user send the same command it'll we'll reply to this cached message
	largeResponseCache?: boolean;

	/** Minimum length to cache large messages */
	minResponseSize?: number;

    /** Callback when command encounter error while  sub type, chat type, or user not allowed*/
    /** You can use `InvalidCommand.REASON` to do checks for specific reason */
    oninvalid?(reason: number, ctx: Context, next: () => Promise<void>): any;
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

	/** Specify cache reply timeout in seconds */
	replyCacheAge: number;

	/** Specify the defaults for commands */
	defaults: CommandConfigs;
}

export interface CommandParams<C extends Context = Context> {
	/** Telegraf context object */
	ctx: C;

	/** Command name */
	command: string;

	/** Raw query string */
	query: string;

	/** Parsed args if exists */
	args?: string[];

	/** Original message object */
	message: TT.Message;

	/** `reply_to` message object if exists  */
	reply_to?: TT.Message;

	isEdited: boolean;

	/**
	 * Message type.
	 * for example, photo, video, or files/documents
	 */
	type: UpdateSubType;

	/**
	 * Message data related to the type of the message for example img will return images links and dimensions and files will return file urls, etc.
	 */
	// TODO improve types on this
	data: Record<string, any>;

    /** Telegraf middleware own next function. call it when you want to pass to the next handler */
	next: () => Promise<void>;
}

type MaybePromise<T> = Promise<T> | T;

// export type CommandParams = Record<string, any>
export type CommandHandler = (arg: CommandParams) => MaybePromise<TT.Message | void | undefined>;
export type Command = CommandConfigs & { handler: CommandHandler };
export type Commands = Map<string, Command>;
export type CommandsInstance = ReturnType<typeof TelegrafEncommands>;
