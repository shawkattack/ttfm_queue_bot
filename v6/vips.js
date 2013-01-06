var VipsModule = require('./proto/utils.js');

var Vips = function (depList) {
    var self = this;

    var __vipMode = false;
    var __vipList = {};
    var __kickList = {};

    const __kickTime = 30*1000;
    const __kickInc = 5*1000;

    VipsModule.call(this,['utils']);
    this.addDependencies(depList);
    this.addHelp({
	'vips':'Prints a list of all vips.'
    });
   
    this.reset = function () {
	__vipList = {};
    };

    this.installHandlers = function () {
	var bot = this.getDep('bot');
	var utils = this.getDep('utils');

	bot.on('update_user', function (data) {
	    var name = data.name;
	    var id = data.userid;
	    if (name) {
		if (__vipList[id] && __vipList[id] !== name) {
		    __vipList[id] = name;
		}
	    }
	});

	bot.on('registered', function (data) {
	    var name = data.user[0].name;
	    var id = data.user[0].userid;
	    if (__vipList[id] && __vipList[id] !== name) {
		__vipList[id] = name;
	    }
	});

	bot.on('add_dj', function (data) {
	    var id = data.user[0].userid;
	    if (__vipMode && !__vipList[id]) {
		bot.remDj(id);
		bot.pm('Sorry, we\'re in VIP mode right now! Sit back and '+
		       'enjoy the tunes :)',id);
	    }
	});
	
	var addKickTimer = function (id, n) {
	    __kickList[id] = setTimeout(function () {
		bot.remDj(id);
	    },__kickTime+__kickInc*n);
	}
	var clearKickTimer = function (id) {
	    clearTimeout(__kickList[id]);
	}
	bot.on('pmmed', function (data) {
	    var reData = null;
	    var sender = data.senderid;
	    var user = utils.getUserById(sender);
	    if (user.mod) {
		if ((reData = data.text.match(/^ *\/?(?:set +)?vip *mode +on *$/i))) {
		    if (__vipMode) {
			bot.pm('We\'re already in VIP mode!',sender);
		    }
		    else {
			self.setVipMode();
			bot.remDj(bot.userId);
			msg = 'WARNING! VIP mode has been activated! ';
			var n = 0;
			var djs = utils.getDjs();
			for (var i in djs) {
			    if (!__vipList[djs[i]]) {
				addKickTimer(djs[i], n);
				var dj = utils.getUserById(djs[i]);
				msg += utils.tagifyName(dj.name);
				msg += ', ';
				n++;
			    }
			}
			if (n > 0) {
			    msg += 'please get off the decks!';
			}
			bot.speak(msg);
		    }
		}
		else if ((reData = data.text.match(/^ *\/?(?:set +)?vip *mode +off *$/i))) {
		    if (!__vipMode) {
			bot.pm('We\'re already out of VIP mode!',sender);
		    }
		    else {
			self.unsetVipMode();
			bot.speak('VIP mode has been deactivated. '+
				  'Thanks, everyone! :)');
			for (var id in __kickList) {
			    clearKickTimer(id);
			}
			__kickList = {};
		    }
		}
		else if ((reData = data.text.match(/^ *\/?vip +(\S.*?) *$/i))) {
		    var target = utils.getUserByTag(reData[1]);
		    if (!target) {
			bot.pm('Sorry, I can\'t find that user :(', sender);
		    }
		    else if (self.addVip(target.id)) {
			bot.pm('Alright, '+target.name+' is now a VIP :)'
			       ,sender);
		    }
		}
		else if ((reData = data.text.match(/^ *\/?unvip +(\S.*?) *$/i))) {
		    var target = utils.getUserByTag(reData[1]);
		    if (!target) {
			bot.pm('Sorry, I can\'t find that user :(', sender);
		    }
		    else if (self.removeVip(target.id)) {
			bot.pm('Alright, '+target.name+' is no longer a VIP :('
			       ,sender);
		    }
		}
		else if ((reData = data.text.match(/^ *\/?reset +vips *$/i))) {
		    self.reset();
		}
		else if ((reData = data.text.match(/^ *\/?vips *$/i))) {
		    msg = '';

		    for (var id in __vipList) {
			msg += __vipList[id];
			msg += ', ';
		    }
		    if (msg) {
			msg = msg.substring(0,msg.length-2);
		    }
		    else {
			msg = 'There are currently no VIPs :(';
		    }
		    bot.pm(msg,sender);
		}
	    }
	});

	// If we're in VIP mode, we have to block all incoming messages
	bot.on('speak', function (data) {
	    var reData = null;
	    if (!__vipMode) {
		self.emit('speak', data);
	    }

	    if ((reData = data.text.match(/^ *\/?vips *$/i))) {
		if (!__vipMode) {
		    bot.speak('We\'re not in VIP mode right now!');
		}
		else {
		    msg = '';

		    for (var id in __vipList) {
			msg += __vipList[id];
			msg += ', ';
		    }
		    if (msg) {
			msg = msg.substring(0,msg.length-2);
		    }
		    else {
			msg = 'There are currently no VIPs :(';
		    }
		    bot.speak(msg);
		}
	    }
	});	
    }

    this.setVipMode = function () {
	var utils = self.getDep('utils');
	__vipMode = true;
	utils.reset();
    }
    this.unsetVipMode = function () {
	__vipMode = false;
	__vipList = {};
    }

    this.addVip = function (id, name) {
	if (!name) {
	    var utils = self.getDep('utils');
	    name = utils.getUserById(id).name;
	}
	__vipList[id] = name;
	return true;
    }
    this.removeVip = function (id) {
	if (!__vipList[id]) {
	    return false;
	}
	delete __vipList[id];
	return true;
    }
}

module.exports = Vips;
