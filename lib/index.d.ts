import { parseArgs, parserOptions } from "./args";
import * as TT from "telegram-typings";
declare const supportedUpdateSubTypes: string[];
declare type CommandHandler = (arg: object) => Promise<TT.Message> | void | undefined | false;
interface CommandConfigs {
    required?: boolean;
    helpMessage?: string;
    parser?: Function;
    parserOptions?: parserOptions;
    allowedUsers?: string[];
    mode?: "private" | "group" | "both";
    subTypes?: typeof supportedUpdateSubTypes[number][];
    allowEdited?: boolean;
    useReply?: boolean;
    deleteOldReplies?: boolean;
    catch?: Function;
}
interface Command extends CommandConfigs {
    handler: CommandHandler;
}
export default class CommandManager {
    private _configs;
    private botReplies;
    private readonly commands;
    static readonly parseArgs: typeof parseArgs;
    set configs(v: CommandConfigs);
    get configs(): CommandConfigs;
    private getMessageSubType;
    private getMessageText;
    get middleware(): import("telegraf/typings/composer").MiddlewareFn<import("telegraf").Context>;
    create(command: string, options?: Command): Command;
    on(command: string, handler: CommandHandler): Command;
}
export {};
