"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const args_1 = require("./args");
const telegraf_1 = require("telegraf");
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("telegraf:encommands");
const supportedUpdateSubTypes = ["text", "audio", "voice", "video", "photo", "document", "sticker"];
// Default options
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
        this.botReplies = {};
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
        // Composer.entity does not work
        return telegraf_1.Telegraf.mount(["edited_message", "message"], (ctx, next) => {
            var _a, _b, _c;
            debug("\nnew message");
            let message = (_a = ctx.editedMessage) !== null && _a !== void 0 ? _a : ctx.message;
            if (!message)
                return next();
            //	ctx.updateSubTypes is broken on edited messages
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
                debug(message);
                if (info) {
                    debug({ [subType]: message[subType] });
                    // if (subType == "photo") {
                    // 	let file = info[info.length - 1];
                    // 	ctx.tg.getFileLink(file.file_id).then(debug);
                    // }
                }
            }
            debug({ subType, isEdited, text });
            let entity = entities && entities[0];
            let isCommand = entity && entity.type == "bot_command" && entity.offset === 0;
            debug({ isCommand });
            if (!isCommand)
                return next();
            debug("command detected");
            let command = text.slice(1, entity.length);
            let query = text.slice(entity.length + 1);
            let cmd = this.commands[command];
            debug(cmd);
            if (!cmd)
                return next();
            if (cmd.allowEdited === false && isEdited)
                return next();
            let botReplyMID = this.botReplies[message_id];
            if (cmd.deleteOldReplies && isEdited && botReplyMID) {
                ctx.deleteMessage(botReplyMID);
                delete this.botReplies[message_id];
            }
            // TODO: Support more than one sub type
            if (cmd.subTypes && !cmd.subTypes.some(v => v == subType))
                return next();
            let chatType = ((_c = message === null || message === void 0 ? void 0 : message.chat) === null || _c === void 0 ? void 0 : _c.id) > 0 ? "private" : "group";
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
            if ((query === null || query === void 0 ? void 0 : query.trim()) === "" && cmd.required) {
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
                ctx,
                command,
                query,
                args,
                message,
                reply,
                replySubType,
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
            }
            else if (returned === false) {
                return next();
            }
        });
    }
    create(command, options) {
        this.commands[command] = Object.assign({}, this._configs, options);
        debug({ command: this.commands[command] });
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