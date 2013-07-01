var AwaysModule = require('./proto/aways.js');

var Aways = function (depList) {
    var self = this;

    const __isQueued = 'isQueued';
    const __isDj = 'isDj';
    const __queueAwayTime = 10*60*1000;
    const __djAwayTime = 55*1000;

    var __awayList = {};
    var __deregisterStore = {};
    var __remDjStore = {};

    AwaysModule.call(this,['queue','utils','vips']);
    this.addDependencies(depList);
    this.addHelp({
	'away':'Type away while on the decks, and I\'ll guard your spot for a '+
	    'minute so you can refresh. Type away while on queue, and I\'ll '+
	    'save your spot for 10 minutes no matter what!',
	'back':'If you marked yourself as away while on queue, type back to '+
	    'let me know you\'ve returned.'
    });

    var clearTimer = function (timer) {
	clearTimeout(timer);
    }
    this.reset = function () {
	for (var i in __awayList) {
	    clearTimer(__awayList[i].timeout);
	}
	__awayList = {};

	__deregisterStore = {};
	__remDjStore = {};
    }

    this.installHandlers = function () {
	var bot = self.getDep('bot');
	var queue = self.getDep('queue');
	var utils = self.getDep('utils');
	var vips = self.getDep('vips');

	queue.on('dequeue', function (data) {
	    self.removeAways(data.id);
	});

	bot.on('add_dj', function (data) {
	    var id = data.user[0].userid;
	    var isQueueAway = self.isAway(id, __isQueued);
	    if (!self.removeAways(id) || isQueueAway) {
		self.emit('add_dj', data);
	    }
	    else {
		delete __remDjStore[id];
	    }
	});

	bot.on('rem_dj', function (data) {
	    var id = data.user[0].userid;
	    if (!self.isAway(id, __isDj)) {
		self.emit('rem_dj', data);
	    }
	    else {
		__remDjStore[id] = data;
	    }
	});

	bot.on('registered', function (data) {
	    delete __deregisterStore[data.user[0].id];
	});
	bot.on('deregistered', function (data) {
	    var id = data.user[0].userid;
	    var away = __awayList[id];
	    if (away) {
		data.awayType = away.type;
		__deregisterStore[id] = data;
	    }
	    else {
		self.emit('deregistered', data);
	    }
	});

	bot.on('speak', function (data) {
	    var reData = null;
	    var id = data.userid;
	    var name = utils.tagifyName(data.name);
	    if ((reData = data.text.match(/^ *\/?away *$/i))) {
		if (utils.isDj(id)) {
		    var tmp = self.addAway(id, data.name, __isDj);
		}
		else if (queue.getQueuePosition(id) !== false) {
		    self.addAway(id, data.name, __isQueued);
		}
		else {
		    bot.speak('You don\'t have a spot for me to hold, '+
			      name+' :P');
		    return;
		}
		bot.speak('OK, got you covered, '+name+'!');
	    }
	    else if ((reData = data.text.match(/^ *\/?back *$/i))) {
		var result = self.removeAways(id);
		if (result) {
		    bot.speak('Gotcha! :)');
		}
	    }
	});
    };

    this.isAway = function (id, type) {
	if (!__awayList[id]) {
	    return false;
	}
	return __awayList[id].type === type;
    };

    this.getAways = function (type) {
	var result = {};
	for (var id in __awayList) {
	    if (__awayList[id].type === type) {
		result[id] = __awayList[id];
	    }
	}
	return result;
    };

    this.addAway = function (id, name, type) {
	var bot = this.getDep('bot');
	var utils = this.getDep('utils');
	var time = null;

	if (type === __isQueued) {
	    time = __queueAwayTime;
	}
	else if (type === __isDj) {
	    time = __djAwayTime;
	}
	else {
	    return null;
	}
	
	__awayList[id] = {
	    name:    name,
	    type:    type,
	    timeout: setTimeout(function () {
		self.removeAways(id);
		var user = utils.getUserById(id);
		if (user) {
		    var tag = utils.tagifyName(user.name);
		    bot.speak('Hey, '+tag+', your brb period is over!');
		}
		else {
		    self.emit('deregistered', __deregisterStore[id]);
		    delete __deregisterStore[id];
		}
		if (__remDjStore[id]) {
		    self.emit('rem_dj',__remDjStore[id]);
		    delete __remDjStore[id];
		}
	    },time)};
	return __awayList[id];
    };

    this.removeAways = function (id) {
	var away = __awayList[id];
	if (!away) {
	    return false;
	}
	clearTimeout(away.timeout);
	delete __awayList[id];
	return true;
    };
}

module.exports = Aways