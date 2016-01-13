var config = require("./config.json");
var games = require("./games.json").games;
var version = require("../package.json").version;
var logger = require("./logger.js").Logger;
var fs = require('fs');

var confirmCodes = []; //stuff for announce
var announceMessages = [];

/*
=====================
Functions
=====================
*/

function correctUsage(cmd) {
	var msg = "Usage: `" + config.mod_command_prefix + "" + cmd + " " + commands[cmd].usage + "`";
	return msg;
}

/*
=====================
Commands
=====================
*/

var commands = {
	"help": {
		desc: "Sends a DM containing all of the commands. If a command is specified gives info on that command.",
		usage: "[command]",
		deleteCommand: true,
		process: function(bot, msg, suffix) {
			var msgArray = [];
			if (!suffix){
				msgArray.push(":information_source: This is a list of mod commands. Use `" + config.mod_command_prefix + "help <command name>` to get info on a specific command.");
				msgArray.push("");
				msgArray.push("**Commands: **");
				msgArray.push("```");
				Object.keys(commands).forEach(function(cmd){ msgArray.push("" + config.mod_command_prefix + "" + cmd + ": " + commands[cmd].desc + ""); });
				msgArray.push("```");
				bot.sendMessage(msg.author, msgArray);
			} else { //if user wants info on a command
				if (commands.hasOwnProperty(suffix)){
					msgArray.push(":information_source: **" + config.mod_command_prefix + "" + suffix + ": **" + commands[suffix].desc);
					if (commands[suffix].hasOwnProperty("usage")) { msgArray.push("**Usage: **`" + config.mod_command_prefix + "" + suffix + " " + commands[suffix].usage + "`"); }
					if (commands[suffix].hasOwnProperty("cooldown")) { msgArray.push("**Cooldown: **" + commands[suffix].cooldown + " seconds"); }
					if (commands[suffix].hasOwnProperty("deleteCommand")) { msgArray.push("This command will delete the message that activates it"); }
					bot.sendMessage(msg.author, msgArray);
				} else { bot.sendMessage(msg.author, ":warning: Command `" + suffix + "` not found."); }
			}
		}
	},
	"stats": {
		desc: "Get the stats of the bot",
		usage: "[-ls (list servers)] ",
		cooldown: 60,
		deleteCommand: true,
		process: function(bot, msg, suffix) {
			if (msg.author.id == config.admin_id || msg.channel.isPrivate || msg.author.id == msg.channel.server.owner.id) { //perm checks all over
				fs.readFile("./logs/debug.txt", 'utf8', function (err, data) {
					if (err) { logger.log("warn", "Error getting debug logs: " + err); }
					logger.log("debug", "Fetched debug logs");
					data = data.split(/\r?\n/); //split by line
					var cmdCount = 0,
						clevCount = 0;
					for (line of data) {
						if (line.indexOf(" - debug: Command processed: ") > -1) { cmdCount += 1; }
						else if (line.indexOf(" asked the bot: ") > -1) { clevCount += 1; }
					}
					var msgArray = [];
					msgArray.push("```");
					msgArray.push("Uptime: " + (Math.round(bot.uptime / (1000 * 60 * 60))) + " hours, " + (Math.round(bot.uptime / (1000 * 60)) % 60) + " minutes, and " + (Math.round(bot.uptime / 1000) % 60) + " seconds.");
					msgArray.push("Connected to " + bot.servers.length + " servers and " + bot.channels.length + " channels.");
					msgArray.push("Serving " + bot.users.length + " users.");
					msgArray.push("Memory Usage: " + Math.round(process.memoryUsage().rss/1024/1000)+"MB");
					msgArray.push("Running BrussellBot v" + version);
					msgArray.push("Commands processed this session: " + cmdCount);
					msgArray.push("Users talked to "+bot.user.username+" "+clevCount+" times");
					msgArray.push("```");
					bot.sendMessage(msg, msgArray);
				});

				if (suffix.indexOf("-ls") != -1 && msg.channel.isPrivate) { //if user wants a list of servers
					var svrArray = [];
					for (svrObj of bot.servers) { svrArray.push("`"+svrObj.name+": C: "+svrObj.channels.length+", U: "+svrObj.members.length+"`"); }
					bot.sendMessage(msg, svrArray);

				}
			} else { bot.sendMessage(msg, "Only server owners can do this."); }
		}
	},
	"playing": {
		desc: "Set what the bot is playing. Leave empty for random. (Don't abuse this, you'll ruin it for everyone).",
		usage: "[game]",
		cooldown: 5,
		deleteCommand: true,
		process: function (bot, msg, suffix) {
			if (!msg.channel.isPrivate) {
				if (msg.channel.server.owner.id == msg.author.id || msg.author.id == config.admin_id) {
					!suffix ? bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]) : bot.setPlayingGame(suffix);
					logger.log("info", "" + msg.author.username + " set the playing status to: " + suffix);
				} else { bot.sendMessage(msg, "Server owners only"); }
			} else { bot.sendMessage(msg, "Must be done in a server"); }
		}
	},
	"clean": {
		desc: "Cleans the specified number of bot messages from the channel.",
		usage: "<number of bot messages 1-100>",
		cooldown: 10,
		deleteCommand: true,
		process: function (bot, msg, suffix) {
			if (suffix && /^\d+$/.test(suffix)) { //if suffix has digits
				if (msg.channel.isPrivate || msg.channel.permissionsOf(msg.author).hasPermission("manageMessages") || msg.author.id == config.admin_id) {
					bot.getChannelLogs(msg.channel, 100, function (error, messages) {
						if (error) { logger.log("warn", "Something went wrong while fetching logs."); return; }
						else {
							bot.startTyping(msg.channel);
							logger.log("debug", "Cleaning bot messages...");
							var todo = parseInt(suffix),
							delcount = 0;
							for (msg1 of messages) {
								if (msg1.author == bot.user) {
									bot.deleteMessage(msg1);
									delcount++;
									todo--;
								}
								if (todo == 0) {
									logger.log("debug", "Done! Deleted " + delcount + " messages.");
									bot.stopTyping(msg.channel);
									return;
								}
							}
							bot.stopTyping(msg.channel);
						}
					});
				} else { bot.sendMessage(msg, ":warning: You must have permission to manage messages in this channel"); }
			} else { bot.sendMessage(msg, correctUsage("clean")); }
		}
	},
	"prune": {
		desc: "Cleans the specified number of messages from the channel.",
		usage: "<number of messages 1-100>",
		cooldown: 15,
		deleteCommand: true,
		process: function (bot, msg, suffix) {
			if (suffix && /^\d+$/.test(suffix)) {
				if (!msg.channel.isPrivate) {
					if (msg.channel.permissionsOf(msg.author).hasPermission("manageMessages")) {
						if (msg.channel.permissionsOf(bot.user).hasPermission("manageMessages")) {
							bot.getChannelLogs(msg.channel, 100, function (error, messages) {
								if (error) { logger.log("warn", "Something went wrong while fetching logs."); return; }
								else {
									bot.startTyping(msg.channel);
									logger.log("debug", "Pruning messages...");
									var todo = parseInt(suffix) + 1;
									var delcount = 0;
									for (cMsg of messages) {
										bot.deleteMessage(cMsg);
										delcount++;
										todo--;
										if (todo == 0 || delcount == 100) {
											logger.log("debug", "Done! Deleted " + delcount + " messages.");
											bot.stopTyping(msg.channel);
											return;
										}
									}
									bot.stopTyping(msg.channel);
								}
							});
						} else { bot.sendMessage(msg, ":warning: I don't have permission to delete messages."); }
					} else { bot.sendMessage(msg, ":warning: You must have permission to manage messages in this channel"); }
				} else { bot.sendMessage(msg, ":warning: Can't do that in a DM"); }
			} else { bot.sendMessage(msg, correctUsage("prune")); }
		}
	},
	"leaves": {
		desc: "Leaves the server.",
		deleteCommand: true,
		process: function(bot, msg, suffix) {
			if (msg.channel.server) {
				if (msg.channel.permissionsOf(msg.author).hasPermission("kickMembers") || msg.author.id == config.admin_id) {
					bot.sendMessage(msg, "It's not like I want to be here or anything, baka").then(
					bot.leaveServer(msg.channel.server));
					logger.log("info", "I've left a server on request of " + msg.sender.username + ". I'm only in " + bot.servers.length + " servers now.");
				} else {
					bot.sendMessage(msg, "You can't tell me what to do! (You need permission to kick users in this channel)");
					logger.log("info", "A non-privileged user (" + msg.sender.username + ") tried to make me leave a server.");
				}
			} else { bot.sendMessage(msg, ":warning: I can't leave a DM."); }
		}
	},
	"announce": {
		desc: "Send a DM to all users in the server. Admins only.",
		deleteCommand: false,
		usage: "<message>",
		process: function (bot, msg, suffix) {
			if (suffix) {
				if (msg.author.id == config.admin_id && msg.channel.isPrivate) { //bot owner to all servers
					if (/^\d+$/.test(suffix)) { //if confirm code
						for (var i = 0; i < confirmCodes.length; i++) {
							if (confirmCodes[i] != suffix) {
								if (i == confirmCodes.length - 1) { bot.sendMessage(msg, "Confirmation code not found"); continue; }
								else { continue; }
							}
							bot.sendMessage(msg, "Announcing to all servers...");
							bot.servers.forEach(function (ser) {
								if (ser.members.length <= 500) { //only if less than 501 members
									setTimeout(function () {
										bot.sendMessage(ser.defaultChannel, ":mega: " + announceMessages[i] + " - " + msg.author.username + " *(bot owner)*");
									}, 1000); //1 message per second
								}
							});
							logger.log("info", "Announced \"" + announceMessages[i] + "\" to servers");
							return;
						}
					} else {
						announceMessages.push(suffix);
						var code = Math.floor(Math.random() * 999999999);
						confirmCodes.push(Math.floor(code));
						bot.sendMessage(msg, ":warning: This will send a private message to **all** of the servers I'm in. If you're sure you want to do this say `"+config.mod_command_prefix+"announce "+code+"`");
					}
				} else if (!msg.channel.isPrivate && msg.channel.permissionsOf(msg.author).hasPermission("manageServer")) {
					if (/^\d+$/.test(suffix)) {
						for (var i = 0; i < confirmCodes.length; i++) {
							if (confirmCodes[i] != suffix) {
								if (i == confirmCodes.length - 1) { bot.sendMessage(msg, "Confirmation code not found"); continue; }
								else { continue; }
							}
							bot.sendMessage(msg, "Announcing to all users, this may take a while...");
							msg.channel.server.members.forEach(function (usr) {
								setTimeout(function () {
									bot.sendMessage(usr, ":mega: " + announceMessages[i] + " - " + msg.author);
								}, 1000);
							});
							logger.log("info", "Announced \"" + announceMessages[i] + "\" to members of "+msg.channel.server.name);
							return;
						}
					} else {
						announceMessages.push(suffix);
						var code = Math.floor(Math.random() * 999999999);
						confirmCodes.push(Math.floor(code));
						bot.sendMessage(msg, ":warning: This will send a private message to **all** members of this server. If you're sure you want to do this say `"+config.mod_command_prefix+"announce "+code+"`");
					}
				} else { bot.sendMessage(msg, ":warning: Server admins only"); }
			} else { bot.sendMessage(msg, ":warning: You must specify a message to announce"); }
		}
	}
}

exports.commands = commands;
