"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const args_1 = require("./args");
const telegraf_1 = require("telegraf");
const supportedUpdateSubTypes = ["text", "audio", "voice", "video", "photo", "document", "sticker"];
const DEFAULTS = {
    required: false,
    parser: args_1.parseArgs,
    mode: "private",
    allowEdited: true,
    useReply: true,
    deleteOldReplies: true,
};
class CommandManager {
    constructor() {
        this._configs = Object.assign({}, DEFAULTS);
        this.botReplies = new Map();
        this.commands = {};
    }
    set configs(v) {
        this._configs = Object.assign({}, DEFAULTS, v);
    }
    get configs() {
        return this._configs;
    }
    getMessageSubType(message) {
        return supportedUpdateSubTypes.find(v => message && v in message);
    }
    getMessageText(message) {
        let subType = this.getMessageSubType(message);
        let isText = subType == "text";
        return {
            text: message[isText ? "text" : "caption"],
            entities: message[isText ? "entities" : "caption_entities"],
        };
    }
    get middleware() {
        return telegraf_1.Telegraf.mount(["edited_message", "message"], (ctx, next) => {
            var _a, _b, _c;
            let message = (_a = ctx.editedMessage) !== null && _a !== void 0 ? _a : ctx.message;
            if (!message)
                return next();
            let subType = this.getMessageSubType(message);
            if (!subType)
                return next();
            let { message_id, reply_to_message: reply } = message;
            let { text, entities } = this.getMessageText(message);
            let updateData = { text, entities };
            let isEdited = !!ctx.editedMessage;
            let user = (_b = message === null || message === void 0 ? void 0 : message.from) === null || _b === void 0 ? void 0 : _b.username;
            let replySubType = this.getMessageSubType(reply);
            if (!text || !entities)
                return next();
            if (subType && subType !== "text") {
                let info = message[subType];
                updateData = Object.assign(Object.assign({}, updateData), info);
            }
            let entity = entities && entities[0];
            let isCommand = entity && entity.type == "bot_command" && entity.offset === 0;
            if (!isCommand)
                return next();
            let command = text.slice(1, entity.length);
            let query = text.slice(entity.length + 1);
            let cmd = this.commands[command];
            if (!cmd)
                return next();
            if (cmd.allowEdited === false && isEdited)
                return next();
            let botReplyMID = this.botReplies.get(message_id);
            if (cmd.deleteOldReplies && isEdited && botReplyMID) {
                ctx.deleteMessage(botReplyMID);
                this.botReplies.delete(message_id);
            }
            if (cmd.subTypes && !cmd.subTypes.some(v => v == subType))
                return next();
            let chatType = ((_c = message === null || message === void 0 ? void 0 : message.chat) === null || _c === void 0 ? void 0 : _c.id) > 0 ? "private" : "group";
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
            if ((query === null || query === void 0 ? void 0 : query.trim()) === "" && cmd.required) {
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
                ctx,
                command,
                query,
                args,
                message,
                reply,
                replySubType,
                isReply: !!reply,
                isEdited,
                updateType: subType,
                updateData,
            };
            let returned = cmd.handler(params);
            if (returned instanceof Promise) {
                returned.then(v => {
                    if (cmd.deleteOldReplies && (v === null || v === void 0 ? void 0 : v.message_id)) {
                        this.botReplies.set(message_id, v.message_id);
                    }
                });
            }
            else if (returned === false) {
                return next();
            }
        });
    }
    create(command, options) {
        this.commands[command] = Object.assign({}, this._configs, options);
        return this.commands[command];
    }
    on(command, handler) {
        return this.create(command, { handler });
    }
}
exports.default = CommandManager;
CommandManager.parseArgs = args_1.parseArgs;
module.exports = CommandManager;
//# sourceMappingURL=index.js.map