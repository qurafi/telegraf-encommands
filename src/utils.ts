import * as TT from "telegram-typings";
import { SUPPORTED_SUBTYPES } from "./types";

export function getMessageSubType(message: TT.Message) {
	return SUPPORTED_SUBTYPES.find(v => message && v in message);
}

export function getMessageText(message: TT.Message) {
	const sub_type = getMessageSubType(message);
	if (!sub_type) return {};

	const is_text = sub_type == "text";
	return {
		text: message[is_text ? "text" : "caption"],
		entities: message[is_text ? "entities" : "caption_entities"],
	};
}

export function getUpdateData(message: TT.Message) {
	const { text, entities } = getMessageText(message);
	const sub_type = getMessageSubType(message);
	const update_data = { text, entities };

	if (!text || !entities) {
		return;
	}

	if (sub_type && sub_type !== "text") {
		const info = message[sub_type];
		return { ...update_data, ...info };
	}

	return update_data;
}

export function parseCommand(message: TT.Message) {
	const { text, entities } = getMessageText(message);
	if (!text || !entities) return;

	const entity = entities && entities[0];
	const is_command = entity && entity.type == "bot_command" && entity.offset === 0;
	if (is_command) {
		const command = text.slice(1, entity.length);
		const query = text.slice(entity.length + 1);
		return { command, query };
	}
}