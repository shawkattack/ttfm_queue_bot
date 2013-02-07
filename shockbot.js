var Bot = require('ttapi');
var ModuleLoader = require('./moduleLoader.js');

var ShockBot = function (configFile) {
    var __cmdTxt = '';
    var self = this;

    // Initialize config and module data
    this.config = require(configFile);

    // Set up le bot
    var botAuth = this.config.botAuth;
    this.bot = new Bot(botAuth.auth, botAuth.userId);

    // Open the module loader, inject reference to bot, connect modules
    var moduleLoader = ModuleLoader;
    moduleLoader.setBot(this.bot);
    moduleLoader.init();
    this.helpDictionary = moduleLoader.getHelp();
    for (var word in this.helpDictionary) {
	__cmdTxt += word + ', ';
    }
    __cmdTxt = __cmdTxt.substring(0,__cmdTxt.length-2);

    this.bot.on('speak', function (data) {
	var reData = null;
	if ((reData = data.text.match(/^ *help *$/i))) {
	    self.bot.speak(self.helpDictionary['help']);
	}
	else if ((reData = data.text.match(/^ *help +(\S.*?) *$/i))) {
	    var word = reData[1].toLowerCase();
	    var helpTxt = self.helpDictionary[word];
	    if (helpTxt) {
		self.bot.speak(helpTxt);
	    }
	}
	else if ((reData = data.text.match(/^ *commands *$/i))) {
	    self.bot.speak(__cmdTxt);
	}
    });

    // After modules have been linked, extract and steal
    var modules = moduleLoader.getAllModules();
    for (var x in modules) {
	this[x] = modules[x];
    }

    // Dispose of the module loader
    moduleLoader = ModuleLoader = null;

    // Join the room
    this.bot.roomId = botAuth.roomId; // Temp fix until Alain changes the code
    this.bot.roomRegister(botAuth.roomId);
}

module.exports = ShockBot;