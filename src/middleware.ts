import { Composer, Context } from "telegraf";
import {
	Command,
	CommandParams,
	Commands,
	constructorConfigs,
	Store,
	supportedUpdateSubTypes,
} from "./types";
import * as TT from "telegram-typings";
import d from "debug";

const debug = d("telegraf:encommands");

export function createMiddleware(configs: constructorConfigs, commands: Commands) {
	return Composer.on(["edited_message", "message"], async (ctx, next) => {
		const message = ctx.editedMessage ?? ctx.message;
		if (!message || !ctx.chat) return next();

		//	ctx.updateSubTypes is broken on edited messags
		const subType = getMessageSubType(message);
		if (!subType) return next();

		// @ts-ignore
		const reply: TT.Message | undefined = message.reply_to_message;
		const isEdited = !!ctx.editedMessage;

		const updateData = getUpdateData(message);
		if (!updateData) return next();

		const { text, entities } = getMessageText(message);
		if (!text || !entities) return next();

		const parsedCommand = parseCommand(message);
		const cmd = parsedCommand && commands.get(parsedCommand.command);
		if (!parsedCommand || !cmd || (isEdited && !cmd.allowEdited)) return next();

		if (!validateCommand(cmd, message, subType, message.from)) {
			return next();
		}

		if (cmd.deleteOldReplies && isEdited) {
			debug("user edited their message, deleting old reply...");
			await findAndDeleteOldBotReply(message.message_id, configs.cacheStore, ctx);
		}

		let { query } = parsedCommand;

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

			return next();
		}

		let args: string[] | undefined;
		if (cmd.parser && typeof query === "string") {
			args = cmd.parser(query, cmd.parserOptions);
		}

		const replyKey = [
			"query",
			message.chat.id,
			parsedCommand.command,
			args ? args.join() : query,
		].join("-");

		const replyFromCache =
			cmd.largeResponseCache &&
			(await replyToMessageIfNotOutdated(
				ctx,
				replyKey,
				configs.cacheStore,
				configs.replyCacheAge
			));

		if (replyFromCache) {
			debug("message retrieved from cache");
			return;
		}

		const params: CommandParams = {
			ctx,
			command: parsedCommand.command,
			query,
			args,
			message,
			reply_to: reply,
			isReply: !!reply,
			isEdited,

			type: subType,
			data: updateData,
		};

		const botReply = await cmd.handler(params);

		if (botReply) {
			if (cmd.deleteOldReplies) {
				// store bot reply so when user edit their message the old bot reply will be deleted
				await configs.cacheStore.set(`id-${message.message_id}`, botReply.message_id);
			}

			const text = botReply.text;
			if (
				cmd.largeResponseCache &&
				text &&
				cmd.minResponseSize &&
				text.length >= cmd.minResponseSize &&
				query.trim() !== ""
			) {
				debug("message stored in cache");
				await configs.cacheStore.set(replyKey, botReply.message_id);
			}
		}

		if (botReply === false) {
			return next();
		}
	});
}

function getMessageSubType(message: TT.Message) {
	return supportedUpdateSubTypes.find(v => message && v in message);
}

function getMessageText(message: TT.Message) {
	const subType = getMessageSubType(message);
	if (!subType) return {};

	const isText = subType == "text";
	return {
		text: message[isText ? "text" : "caption"],
		entities: message[isText ? "entities" : "caption_entities"],
	};
}

function getUpdateData(message: TT.Message) {
	const { text, entities } = getMessageText(message);
	const subType = getMessageSubType(message);
	const updateData = { text, entities };

	if (!text || !entities) {
		return;
	}

	if (subType && subType !== "text") {
		const info = message[subType];
		return { ...updateData, ...info };
	}

	return updateData;
}

function parseCommand(message: TT.Message) {
	const { text, entities } = getMessageText(message);
	if (!text || !entities) return;

	const entity = entities && entities[0];
	const isCommand = entity && entity.type == "bot_command" && entity.offset === 0;
	if (isCommand) {
		const command = text.slice(1, entity.length);
		const query = text.slice(entity.length + 1);
		return { command, query };
	}
}

async function findAndDeleteOldBotReply(message_id: number, store: Store, ctx: Context) {
	const key = `id-${message_id}`;
	const botReplyMID = await store.get(key);

	if (botReplyMID) {
		await ctx.deleteMessage(botReplyMID);
		await store.delete(key);
	}
}

function validateCommand(cmd: Command, message: TT.Message, subType: string, user: TT.User) {
	const validSubType = !cmd.subTypes || cmd.subTypes.some(v => v == subType);

	const chatType = message.chat.id > 0 ? "private" : "group";

	const validChatType = cmd.mode === "both" || cmd.mode == chatType;

	const allowedUsers = cmd.allowedUsers;
	const isUserAllowed =
		!allowedUsers || allowedUsers.some(username => username === user.username);

	return validChatType && validSubType && isUserAllowed;
}

async function replyToMessageIfNotOutdated(
	ctx: Context,
	replyKey: string,
	cache: Store,
	age: number
) {
	const cachedMessageId = await cache.get(replyKey);
	if (!cachedMessageId) return;
	try {
		const botReply = await ctx.replyWithMarkdown("`  👆`", {
			reply_to_message_id: cachedMessageId,
		});

		const dmsg = botReply.reply_to_message?.date;

		if (dmsg && Date.now() / 1000 - dmsg > age) {
			await cache.delete(replyKey);
			ctx.deleteMessage(botReply.message_id);
			return;
		}

		return botReply;
	} catch (e) {
		return;
	}
}
