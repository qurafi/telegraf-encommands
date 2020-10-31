/* eslint-disable @typescript-eslint/no-var-requires */

require("dotenv").config();
const Telegraf = require("telegraf");
const CommandManager = require("./lib");

// https://github.com/mhmd-22/dynamo-kvstore
const dynamoStore = require("dynamo-kvstore");

const bot = new Telegraf(process.env.BOT_TOKEN);
const commands = new CommandManager();

const config = {
	endpoint: "http://localhost:7000",
	region: "us-east-2",
};

// save large bot replies to database and if user send the same command it'll refer to it
const Store = new dynamoStore("bot-replies", config);
Store.then(v => {
	commands.cacheStore = v;
});

commands.configs = {
	required: true,
	helpMessage: "*set your help message here*",
};

bot.use(commands.middleware);

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
			return ctx.reply(`${query}`);
		}
	},
});

// reply with width and height of the photo
commands.create("photo", {
	subTypes: ["photo"],
	required: false,
	handler: ({ ctx, updateData }) => {
		return ctx.reply(`${updateData[0].width}x${updateData[0].height}`);
	},
});

// next()
bot.on("message", ctx => {
	ctx.reply("hello");
});

bot.launch();
