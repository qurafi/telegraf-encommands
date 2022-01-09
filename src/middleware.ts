import { Composer, Context } from "telegraf";
import {
	Command,
	CommandParams,
	Commands,
	constructorConfigs,
	Store,
	SUPPORTED_SUBTYPES,
} from "./types";
import * as TT from "telegram-typings";
import d from "debug";
import { getMessageSubType, getUpdateData, getMessageText, parseCommand } from "./utils";

const debug = d("telegraf:encommands");

export enum InvalidCommand {
    INVALID_CHAT_TYPE,
    INVALID_MESSAGE_TYPE,
    USER_NOT_ALLOWED,
    REQUIRED,
}

export function createMiddleware(configs: constructorConfigs, commands: Commands) {
	return Composer.on(["edited_message", "message"], async (ctx, next) => {
		const message = ctx.editedMessage ?? ctx.message;
		if (!message || !ctx.chat) return next();

		//	ctx.updateSubTypes is broken on edited messages
		const sub_type = getMessageSubType(message);
		if (!sub_type) return next();

		// @ts-ignore
		const reply: TT.Message | undefined = message.reply_to_message;
		const is_edited = !!ctx.editedMessage;

		const update_data = getUpdateData(message);
		if (!update_data) {
            return next();
        }

		const { text, entities } = getMessageText(message);
		if (!text || !entities) {
            return next();
        }

		const parsed_command = parseCommand(message);
		const cmd = parsed_command && commands.get(parsed_command.command);
		if (!parsed_command || !cmd || (is_edited && !cmd.allowEdited)) {
            return next();
        }

        const {valid, reason} = validateCommand(cmd, message, sub_type, message.from)
		if (!valid) {
			return cmd.oninvalid?.(reason, ctx, next);
		}

		if (cmd.allowEdited && is_edited) {
			debug("user edited their message, deleting old reply...");
			await findAndDeleteOldBotReply(message.message_id, configs.cacheStore, ctx);
		}

		let { query } = parsed_command;

		if (query.trim() == "" && cmd.useRepliedTo && reply) {
			const { text } = getMessageText(reply);
			if (text && text.trim() != "") {
				query = text;
			}
		}

		if (query?.trim() === "" && cmd.required) {
			if (cmd.helpMessage) {
				return ctx.replyWithMarkdown(cmd.helpMessage);
			}

            cmd.oninvalid?.(InvalidCommand.REQUIRED, ctx, next)
			return;
		}

		let args: string[] | undefined;
		if (cmd.parser && typeof query === "string") {
			args = cmd.parser(query, cmd.parserOptions);
		}

		const reply_key = [
			"query",
			message.chat.id,
			parsed_command.command,
			args ? args.join() : query,
		].join("-");

		const reply_from_cache =
			cmd.largeResponseCache &&
			(await replyToMessageIfNotOutdated(
				ctx,
				reply_key,
				configs.cacheStore,
				configs.replyCacheAge
			));

		if (reply_from_cache) {
			debug("message retrieved from cache");
			return;
		}

		const params: CommandParams = {
			ctx,
			command: parsed_command.command,
			query,
			args,
			message,
			reply_to: reply,
			isEdited: is_edited,

			type: sub_type,
			data: update_data,

			next,
		};

		const bot_reply = await cmd.handler(params);

		if (!bot_reply) return;

		if (cmd.allowEdited) {
			// store bot reply so when user edit their message the old bot reply will be deleted
			await configs.cacheStore.set(`id-${message.message_id}`, bot_reply.message_id);
		}

		const reply_text = bot_reply.text;
		if (!reply_text) return;

		const is_in_minimum_size = cmd.minResponseSize && reply_text.length >= cmd.minResponseSize;
		if (cmd.largeResponseCache && reply_text && is_in_minimum_size && query.trim() !== "") {
			debug("message stored in cache");
			await configs.cacheStore.set(reply_key, bot_reply.message_id);
		}
	});
}

async function findAndDeleteOldBotReply(message_id: number, store: Store, ctx: Context) {
	const key = `id-${message_id}`;
	const bot_reply_mid = await store.get(key);

	if (bot_reply_mid) {
		await ctx.deleteMessage(bot_reply_mid);
		await store.delete(key);
	}
}

function validateCommand(cmd: Command, message: TT.Message, sub_type: string, user: TT.User) {
	const valid_sub_type = !cmd.subTypes || cmd.subTypes.some(v => v == sub_type);

	const chat_type = message.chat.id > 0 ? "private" : "group";

	const valid_chat_type = cmd.mode === "both" || cmd.mode == chat_type;

	const allowed_users = cmd.allowedUsers;
	const is_user_allowed =
		!allowed_users || allowed_users.some(username => username === user.username);

    const invalid_index = [valid_chat_type, valid_sub_type, is_user_allowed].indexOf(false);
	return {valid: invalid_index < 0, reason: invalid_index};
}

async function replyToMessageIfNotOutdated(
	ctx: Context,
	reply_key: string,
	cache: Store,
	age: number
) {
	const cached_message_id = await cache.get(reply_key);
	if (!cached_message_id) return;
	try {
		const bot_reply = await ctx.replyWithMarkdown("`  👆`", {
			reply_to_message_id: cached_message_id,
		});

		const message_date = bot_reply.reply_to_message?.date;

		if (message_date && (Date.now() / 1000) - message_date > age) {
			await cache.delete(reply_key);
			ctx.deleteMessage(bot_reply.message_id);
			return;
		}

		return bot_reply;
	} catch (e) {
		// ignore any error when replying to cached message
		return;
	}
}
