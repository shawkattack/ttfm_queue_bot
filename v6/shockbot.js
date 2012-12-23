var Bot = require('ttapi');
var ModuleLoader = require('./moduleLoader.js');

var ShockBot = function (configFile) {
    // Initialize config and module data
    this.config = require(configFile);

    // Set up le bot
    var botAuth = this.config.botAuth;
    this.bot = new Bot(botAuth.auth, botAuth.userId);

    // Open the module loader, inject reference to bot, connect modules
    var moduleLoader = ModuleLoader;
    moduleLoader.setBot(this.bot);
    moduleLoader.init();

    // After modules have been linked, extract and steal
    var modules = moduleLoader.getAllModules();
    for (var x in modules) {
	this[x] = modules[x];
    }

    // Dispose of the module loader
    moduleLoader = ModuleLoader = null;

    // Join the room
    this.bot.roomRegister(botAuth.roomId);
}

module.exports = ShockBot;