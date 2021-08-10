/* eslint-disable @typescript-eslint/no-var-requires */

require("dotenv").config();
const { Telegraf } = require("telegraf");
const { TelegrafEncommands } = require("./lib");

// https://github.com/mhmd-22/dynamo-kvstore
const dynamoStore = require("dynamo-kvstore");

async function init() {
	try {
		const bot = new Telegraf(process.env.BOT_TOKEN);

		const commands = TelegrafEncommands({
			// save large bot replies to database and if user send the same command it'll refer to it
			cacheStore: await new dynamoStore("bot-replies", {
				endpoint: "http://localhost:7000",
				region: "us-west-2",
			}),
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

function initializeCommands(commands) {
	// create new command with default configs
	commands.on("test", ({ ctx, command, query }) => {
		return ctx.reply(`/${command} ${query}`);
	});

	// take the replied to message as command query
	commands.create("echo", {
		required: false,
		useReply: true,
		handler: ({ ctx, isReply, query }) => {
			if (isReply) {
				return ctx.reply(`reply: ${query}`);
			}
		},
	});

	commands.create("test2", {
		required: true,
		helpMessage: "invalid command arguments",
		handler: ({ ctx, query }) => {
			return ctx.reply(query);
		},
	});

	// reply with width and height of the photo
	commands.create("file", {
		subTypes: ["photo", "sticker", "video", "voice", "audio", "document"],
		required: false,
		handler: ({ ctx, data, type }) => {
			return ctx.reply(`${type}: \`${JSON.stringify(data)}\``);
		},
	});
}

init();
