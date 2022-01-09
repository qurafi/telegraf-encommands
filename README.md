# Telegraf-encommands
![npm](https://img.shields.io/npm/v/telegraf-encommands)  ![NPM](https://img.shields.io/npm/l/telegraf-encommands)

###### Enhanced command manager for Telegraf.js

## Features
- Compatible with the latest Telegraf.js 4.x version
- Typescript support
- Support edited messages and replies.
- Delete old bot replied using in-memory caching or you can set your own custom cache store.
- Set which users are allowed to run a specific command.
- Set command to run on a specific chat type(e.g. private only) or update-type(e.g. photos only).
- Customizable argument parser.
- Reply to the last cached bot reply if user send the same command (useful for less database queries and less chat distracting for large bot messages)
- ...and more

## Installation

`npm i telegraf-encommands`

## Examples

##### Basic command

```javascript
import {TelegrafEncommands} from "telegraf-encommands";

const bot = new Telegraf(process.env.BOT_TOKEN);
const commands = TelegrafEncommands(options);

bot.use(commands.middleware);

// using default configurations
commands.on("test", ({ ctx, args }) => {
    return ctx.reply("hello from command test");
});
```

##### Command on target message type

```javascript
// reply with width and height of photo
commands.create("photo", {
    subTypes: ["photo"],
    required: false,
    handler: ({ ctx, data }) => {
        return ctx.reply(`${data[0].width}x${data[0].height}`);
    },
});

// all files
commands.create("file", {
    subTypes: ["photo", "sticker", "video", "voice", "audio", "document"],
    required: false,
    handler: ({ ctx, data, type }) => {
        const info = JSON.stringify(data, null, 2);
        return ctx.replyWithMarkdownV2(`${type}: \`${info}\``);
    },
        
    oninvalid(reason, ctx, next) {
        console.log(reason);
        if (reason == InvalidCommand.INVALID_MESSAGE_TYPE) {
            return ctx.reply("File is required")
        }
        return next()
    },
});
```

##### Set command only for allowed users

```javascript
commands.create("secret", {
    required: false,
    allowedUsers: ["username"],
    handler: ({ ctx }) => {
        return ctx.reply(`secret`);
    },
});
```

##### Use replied_to_message as command query

```javascript
commands.create("echo", {
    required: false,
    useRepliedTo: true,
    handler: ({ ctx, reply_to, query }) => {
        if (reply_to) {
            return ctx.reply(`reply: ${query}`);
        }
    },
});
```

refer to [./example.js](./example.js)

## Usage
```javascript
const commands = new TelegrafEncommand({
    // where to store cached message, should have set, get, and delete.
    // default is Map(in memory)
    cacheStore: Store,

    // specify time of caching in second
    replyCacheAge: number,

    // default command options
    defaults: {
        // require arguments to run this command
        required: boolean,

        // define help message when required=true and the arguments is empty, next() will be called when undefined
        helpMessage: string,

        // a function called to parse raw query called with (query, options)
        parser: parseArgs,
        parserOptions, // parser options passed to the above function

        // list of user allowed to run commands. passing undefined will allow all users
        allowedUsers: string[],

        // where to allow commands to run
        mode: "both" | "private" | "group",
        
        // re-run command when user edit their message
        allowEdited: true,

        // allow using replied_to_message as query when reply with a command. this only works when command invoked with no arguments
        useRepliedTo: true,

        // store bot replies and delete them when reply to edited message
        deleteOldReplies: true,

        // cache messages with size specified below
        largeResponseCache: true,
        minResponseSize: 10,


        // runs when trying to run this command with invalid input (empty arguemnts, invalid chat type or message type, user not allowed)
        oninvalid(reason, ctx, next)
    },
});

// register the middleware
bot.use(commands.middleware);


// create command with default configs
commands.on("test", onCommandTest)

// create command with custom options
commands.create("test", {
    required: true,
    helpMessage: "this is a help message",
    handler: onCommandTest,
    // more options in src/types.ts
})

// handler for the command
function onCommandTest(params) {
    // Available paramaters :
    //  ctx : Telegraf context object
    //  command: command name
    //  query: raw query
    //  args: parsed arguments if exists
    //  message: message object from context object
    //  type: message type
    //  data: data related to the type of message
    //  reply_to: replied to message same as message.reply_to_message
    //  isEdited
    //  next, telegraf next function

    const {command, query, args} = params
    console.log(args)

    // bot reply should be returned in order for deleteOldReplies to work
    // if the returned value is false. it will pass next()
    return ctx.reply("command executed")
}
```