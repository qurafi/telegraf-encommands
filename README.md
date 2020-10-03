# Telegraf-encommands

Enhanced command manager for telegraf.js

## Features

- Support reply messages.
- Support edited messages.
- Delete old bot replied using in-memory caching.
- Set which users are allowed to run a specific command.
- Set command to run on specific chat type(e.g private only) or update-type(e.g photos only).
- Customizable arguments parser.

## Installation

`npm i telegraf-encommands`

## Examples

##### Basic command

```javascript
const bot = new Telegraf(process.env.BOT_TOKEN);
const commands = new CommandManager();
bot.use(commands.middleware);

// will use default configs
commands.on("test", ({ ctx, args }) => {
	console.log(args);
	return ctx.reply("hello from command test");
});
```

##### Command on target message type

```javascript
// reply with width and height of photo
const bot = new Telegraf(process.env.BOT_TOKEN);
const commands = new CommandManager();

bot.use(commands.middleware);

commands.create("photo", {
	subTypes: ["photo"],
	required: false,
	handler: ({ ctx, updateData }) => {
		return ctx.reply(`${updateData[0].width}x${updateData[0].height}`);
	},
});
```

##### Command for allowed users

```javascript
commands.create("secret", {
	required: false,
	allowedUsers: ["username"],
	handler: ({ ctx }) => {
		return ctx.reply(`secret`);
	},
});
```

##### Use replied to message as query

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
let commands = new CommandManager();

// register the middleware
bot.use(commands.middleware);

function onCommandTest(params) {
    // Available params :
    // ctx : telegraf context object
    // command: command name
    // query: raw query
    // args: parsed arguments if exists
    // message: message object from context object
    // reply: message object of reply message
    // replySubType: reply message type
    // updateType: type of message
    // updateData: data related to the type of message
    // isReply
    // isEdited

    const {command, query, args} = params
    console.log(args)

    return ctx.reply("command executed")
}

// create command with default configs
bot.on("test", onCommandTest)

// create command with options
bot.create("test", {
    // can run without specific args
    required: false,
    helpMessage: "this is a help message",
    handler: onCommandTest,

    // see index.ts file for more options
})

// set default configs for commands instance
commands.configs = {
    // NOTE: help message is formatted with markdown
    helpMessage: "This is a help message",

    // set your custom parser function
    // this is called with (query, parserArgOptions)
    parser: (query, options) => {
        return query.split(" ")
    }

    // pass your options to the arg parser
    parserArgOptions: {}

    // more options available in index.ts file
}
```

## TODO

- Support async handlers
