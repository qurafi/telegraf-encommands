require("dotenv").config();
const Telegraf = require("telegraf");
const CommandManager = require("./lib");

const bot = new Telegraf(process.env.BOT_TOKEN);

const commands = new CommandManager();
commands.configs = {
	required: true,
	helpMessage: "*set your help message here*",
};

bot.use(commands.middleware);

// create new command with default configs
commands.on("test", ({ ctx, command, query }) => {
	ctx.reply("hello from command test");
});

// take the replied to message as the command query
commands.create("echo", {
	required: false,
	useReply: true,
	handler: ({ ctx, isReply, query }) => {
		if (isReply) {
			return ctx.reply(`${query}`);
		}
	},
});

// reply with width and height of photo

commands.create("photo", {
	subTypes: ["photo"],
	required: false,
	handler: ({ ctx, updateData }) => {
		return ctx.reply(`${updateData[0].width}x${updateData[0].height}`);
	},
});

bot.on("message", ctx => {
	ctx.reply("hello");
});

bot.launch();
