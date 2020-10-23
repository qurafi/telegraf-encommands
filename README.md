# Telegraf-encommands

Enhanced command manager for Telegraf.js

## Features

- Support edited messages and replies.
- Delete old bot replied using in-memory caching.
- Set which users are allowed to run a specific command.
- Set command to run on specific chat type(e.g. private only) or update-type(e.g. photos only).
- Customizable argument parser.

## Installation

`npm i telegraf-encommands`

## Examples

##### Basic command

```javascript
const bot = new Telegraf(process.env.BOT_TOKEN);
const commands = new CommandManager();
bot.use(commands.middleware);

commands.on("test", ({ ctx, args }) => {
    console.log(args);
    return ctx.reply("hello from command test");
});
```

##### Command on target message type

```javascript
// reply with width and height of photo
commands.create("photo", {
    subTypes: ["photo"],
    required: false,
    handler: ({ ctx, updateData }) => {
        return ctx.reply(`${updateData[0].width}x${updateData[0].height}`);
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
    useReply: true,
    handler: ({ ctx, isReply, query }) => {
        if (isReply) {
            return ctx.reply(`${query}`);
        }
    },
});
```

## Usage
```javascript
// set up new instnace
let commands = new CommandManager();

// register the middleware
bot.use(commands.middleware);


// create command with default configs
bot.on("test", onCommandTest)

// create command with custom options
bot.create("test", {
    required: false, // can run without specific args
    helpMessage: "this is a help message",
    handler: onCommandTest,
    // more options in index.ts
})

// handler for the command
function onCommandTest(params) {
    // Available paramaters :
    //  ctx : Telegraf context object
    //  command: command name
    //  query: raw query
    //  args: parsed arguments if exists
    //  message: message object from context object
    //  reply: message object of reply
    //  replySubType: type of reply message
    //  updateType: type of message
    //  updateData: data related to the type of message
    //  isReply
    //  isEdited

    const {command, query, args} = params
    console.log(args)

    // bot reply should be returned in order for deleteOldReplies to work
    // if the returned value is false. it will pass next()
    return ctx.reply("command executed")
}

// set default configs for commands instance
commands.configs = {
    // NOTE: help messages are formatted with markdown
    helpMessage: "*set your help message here*",

    // set your custom parser function
    // this is called with (query, parserArgOptions)
    parser: (query, options) => query.split(" ")

    // pass your options to the arg parser
    parserArgOptions: {}

    // more options are available in index.ts file
}
```