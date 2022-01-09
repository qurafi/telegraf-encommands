const { Telegraf } = require("telegraf");
const { TelegrafEncommands } = require("../lib/index");
const defaultConfigs = {
	required: true,
	helpMessage: "this is a help message",
	mode: "private",
	allowedUsers: ["telegraf"],
	replyCacheAge: 3,
};

// copied from: https://github.com/telegraf/telegraf/blob/develop/test/composer.js
const base_message = { chat: { id: 1 }, from: { id: 42, username: "telegraf" } };
const base_group_message = {
	chat: { id: -1, type: "group" },
	from: { id: 42, username: "telegraf" },
};

// HACK: bot token required means that the message has been sent successfully
function ignoreBotToken(bot, done) {
	bot.catch(e => {
		done(e.code !== 401 && e);
	});
}

function setupBot(done, configs = defaultConfigs) {
	const bot = new Telegraf();
	bot.botInfo = { id: 42, is_bot: true, username: "bot", first_name: "Bot" };

	const commands = TelegrafEncommands({
		...configs,
	});

	bot.use(commands.middleware);

	return { bot, commands, sendCommand: sendCommand.bind(null, bot), sendMessage: sendMessage.bind(null, bot)};
}

function setupTest({
	name = "",
	shouldRun = true,
    shouldRunNext = false,
    shouldInvalid = false,
    InvalidReason,
	query = "query string",
	target = "private",
	message = {},
	options = {},
	isEdited,
	test: testfn,
}) {
	it(name, async done => {
        const onInvalidMock = jest.fn(((reason) => {
            if (shouldInvalid) {
                done();
            } else {
                throw Error("invalid shouldn't run")
            }
        }))

		const { bot, commands, sendCommand } = setupBot(done, {
			...defaultConfigs,
			...options,
            oninvalid: onInvalidMock,
		});

		ignoreBotToken(bot, done);

        const commandMock = jest.fn(async params => {
			if (!shouldRun) {
				throw Error("command expected to not run");
			}


			if (testfn) {
                await testfn(params);
            }

			done();
		})

        const nextMock = jest.fn(() => {
			if (shouldRun) {
				throw Error("next() should not be called");
			} else {
				done();
			}
		})
        
		commands.on("test", commandMock);

		bot.on(isEdited ? "edited_message" : "message", nextMock);

        sendCommand("test", query, target == "group", message, isEdited);
	});
}

function sendMessage(bot, content, target, other_options = {}, isEdited) {
	let sub_type = other_options.subType;
	if (sub_type) {
		other_options[sub_type] = {};
	}

	let text = sub_type ? "caption" : "text";
	let message = {
		[text]: content,
		...(target ? base_group_message : base_message),
		...other_options,
	};

	return bot.handleUpdate({ [isEdited ? "edited_message" : "message"]: message });
}

function sendCommand(bot, command, query = "", target, other_options = {}, isEdited) {
	let sub_type = other_options.subType;
    let entities = sub_type ? "caption_entities" : "entities";
    other_options = {
        [entities]: [{ type: "bot_command", offset: 0, length: command.length + 1 }],
        ...other_options,
    }
    return sendMessage(bot, `/${command} ${query}`, target, other_options, isEdited)
}

module.exports = {
	ignoreBotToken,
	setupBot,
	setupTest,
	sendCommand,
};
