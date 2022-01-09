require("dotenv").config();
const { Telegraf } = require("telegraf");
const { TelegrafEncommands, InvalidCommand } = require("./lib");

// Example of cache store using AWS DynamoDB
// https://github.com/mhmd-22/dynamo-kvstore
// const dynamoStore = require("dynamo-kvstore");


/** @param {ReturnType<TelegrafEncommands>} commands */
function initializeCommands(commands) {


	// create new command with default configs
	commands.on("test", ({ ctx, command, query }) => {
		return ctx.reply(`/${command} ${query}`);
	});

    // create command with custom configs
	// Here we allow useRepliedTo option to take the replied to message as command query
	commands.create("echo", {
		required: false,
		useRepliedTo: true,
		handler: ({ ctx, reply_to, query }) => {
			if (reply_to) {
				return ctx.reply(`reply: ${query}`);
			}
		},
	});

	commands.create("test2", {
		required: true,
		// helpMessage: "invalid command arguments",
		handler: ({ ctx, query }) => {
			return ctx.reply(query);
		},
	});

	// Reply with file details
	commands.create("file", {
		subTypes: ["photo", "sticker", "video", "voice", "audio", "document"],
		required: false,
		handler: ({ ctx, data, type }) => {
			return ctx.replyWithMarkdownV2(`${type}: \`${JSON.stringify(data, null, 2)}\``);
		},
        
        oninvalid(reason, ctx, next) {
            console.log(reason);
            if (reason == InvalidCommand.INVALID_MESSAGE_TYPE) {
                return ctx.reply("File is required")
            }
            return next()
        },
	});
}

async function init() {
	try {
		const bot = new Telegraf(process.env.BOT_TOKEN);

		const commands = TelegrafEncommands({
            // Example of using custom cache store
			// cacheStore: await new dynamoStore("bot-replies", {
			// 	endpoint: "http://localhost:7000",
			// 	region: "us-west-2",
			// }),
			replyCacheAge: 60, // one minute
			defaults: {
				required: true,
				useReply: true,
				helpMessage: "*set your help message here*",
			},
		});

		initializeCommands(commands);

		bot.use(commands.middleware);

		// next()
		bot.on("message", ctx => {
			ctx.reply("hello");
		});

		bot.catch(err => {
			console.error(err);
		});

		await bot.launch();
	} catch (e) {
		console.error(e);
	}
}

init();
