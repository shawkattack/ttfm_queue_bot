var QueueModule = require('./proto/queue.js');

// TODO add away management

var Queue = function (depList) {
    var self = this;

    var __queue = [];
    var __callTimer = null;
    var __callInfo = null;
    var __deleteTimers = {};

    var __cheaters = {};

    const __callTime = 40*1000;
    const __removeTime = 5*60*1000;

    const __isDj = 'isDj';
    const __isAway = 'isAway';
    const __isQueued = 'isQueued';
    const __isBot = 'isBot';
    const __zeroMove = 'zeroMove';
    const __success = true;

    QueueModule.call(this,['utils','aways','kicks']);
    this.addDependencies(depList);

    this.installHandlers = function () {
	var bot = self.getDep('bot');
	var utils = self.getDep('utils');
	var aways = self.getDep('aways');
	var kicks = self.getDep('kicks');
	console.log(kicks);

	bot.on('registered', function (data) {
	    var spot = self.getQueuePosition(data.user[0].userid);
	    if (spot !== false) {
		clearTimeout(__deleteTimers[data.user[0].userid]);
		delete __deleteTimers[data.user[0].userid];
		__queue[spot].name = data.user[0].name;
	    }
	});
	bot.on('deregistered', function (data) {
	    var spot = self.getQueuePosition(data.user[0].userid);
	    if (spot !== false) {
		__deleteTimers[data.user[0].userid] = setTimeout(function () {
		    self.dequeue(data.user[0].userid);
		}, __removeTime);
	    }
	});

	bot.on('update_user', function (data) {
            if (data.name) {
		var spot = self.getQueuePosition(data.userid);
		if (spot !== false) {
		    __queue[spot].name = data.name;
		}
            }
        });

	bot.on('add_dj', function (data) {
	    var qAways = aways.getAways(__isQueued);
	    var spot = self.getRealQueuePosition(data.user[0].userid, qAways);
	    var end = self.getRealQueuePosition('', qAways);
	    if (spot <= utils.getNumSpots()) {
		self.cancelCall();
		self.dequeue(data.user[0].userid);
		if (utils.getNumSpots() > 0) {
		    self.callNext();
		}
	    }
	    else if (spot < end) {
		__cheaters[data.user[0].userid] = true;
		bot.speak('No cutting! >:C');
		bot.remDj(data.user[0].userid);
	    }
	    else {
		__cheaters[data.user[0].userid] = true;
		bot.speak('Sorry, I\'m saving that spot for '+'. If you want to DJ, type q+ into chat');
		bot.remDj(data.user[0].userid);
	    }
	});
	bot.on('rem_dj', function (data) {
	    if (__cheaters[data.user[0].userid] === true) {
		delete __cheaters[data.user[0].userid];
		return;
	    }
	    if (utils.getNumSpots() > 0) {
		self.callNext();
	    }
	});

	bot.on('speak', function (data) {
	    var utils = self.getDep('utils');
	    var aways = self.getDep('aways');
	    var reData = null;
	    var tag = utils.tagifyName(data.name);
	    if (utils.isMod(data.userid)) {
		if ((reData = data.text.match(/^ *\/?q([+-][0-9]+) +(\S.*?) *$/i))) {
		    var amt = -parseInt(reData[1], 10);
		    var uData = utils.getUserByTag(reData[2]);
		    if (!uData) {
			bot.speak('Sorry, I can\'t find that user!');
			return;
		    }
		    var qAways = aways.getAways(__isQueued);
		    var oldSpot = self.getRealQueuePosition(uData.id, qAways);
		    var result = self.moveInQueue(uData.id, amt);
		    var newSpot = -1;
		    var msg = '';
		    switch(result) {
		    case __isDj:
			msg = uData.name+' is already on the decks :P';
			break;
		    case __isAway:
			msg = 'I\'m already saving a spot for '+uData.name;
			break;
		    case __isBot:
			msg = 'Nope, sorry. Can\'t put me on the queue :P';
			break;
		    case __zeroMove:
			msg = 'Y U MOVE 0???';
			break;
		    default:
			msg = uData.name+' has been moved to spot '+(result+1);
			if (oldSpot === false) {
			    oldSpot = -1;
			}
			newSpot = self.getRealQueuePosition(uData.id, qAways);
		    }

		    bot.speak(msg);
		    if (__callInfo !== null && __callInfo.id === uData.id &&
			newSpot > oldSpot) {
			self.callNext();
		    }
		}
	    }

	    if ((reData = data.text.match(/^ *\/?q\+ *$/i))) {
		var result = self.enqueue(data.userid, data.name);
		var msg = '';
		switch(result) {
		case __isDj:
		    msg = 'You\'re already on the decks, '+tag+' :P';
		    break;
		case __isAway:
		    msg = 'I\'m holding your spot, '+tag+'. '+
			'Quit fooling around and hop up!';
		    break;
		case __isQueued:
		    msg = 'You\'re already on the queue, '+tag+' :P';
		    break;
		case __isBot:
		    msg = 'Well that wasn\'t supposed to happen :P';
		    break;
		default:
		    if (self.getRealQueuePosition(data.userid)+1 <=
			utils.getNumSpots()) {
			msg = 'Hop on up, '+tag+' ;)';
		    }
		    else {
			msg = 'I\'ve added you to the queue, '+tag+' :)';
		    }
		}
		bot.speak(msg);
	    }
	    else if ((reData = data.text.match(/^ *\/?q- *$/i))) {
		var result = self.dequeue(data.userid);
		if (result === false) {
		    bot.speak('You\'re not on the queue, '+tag+' :P');
		}
		else {
		    bot.speak('I\'ve removed you from the queue, '+tag);
		}
	    }
	    else if ((reData = data.text.match(/^ *\/?q\? *$/i))) {
		self.printQueue();
	    }
	    else if ((reData = data.text.match(/^ *\/?my *spot *$/i))) {
		self.printSpot(data.userid);
	    }
	});
    };

    this.getQueuePosition = function (id) {
        for (var i = 0; i < self.getQueueSize(); i++) {
	    if (__queue[i].id === id) {
		return i;
	    }
	}
	return false;
    };

    // Assumes ignoreList is a js Object mapping userids to other Objects
    this.getRealQueuePosition = function (id, ignoreList) {
	var aways = this.getDep('aways');
	if (ignoreList === undefined || ignoreList === null) {
	    ignoreList = aways.getAways(__isQueued);
	}
	var idx = 0;
        for (var i = 0; i < self.getQueueSize(); i++) {
	    if (__queue[i].id === id) {
		break;
	    }
	    if (!ignoreList[__queue[i].id]) {
		idx++;
	    }
	}
	return idx;
    };

    this.callNext = function () {
	var bot = self.getDep('bot');
	var utils = self.getDep('utils');
	var aways = self.getDep('aways');
	var tag;
	
	self.cancelCall();
	for (var i = 0; i < self.getQueueSize(); i++) {
	    if (!aways.isAway(__queue[i].id, __isQueued)) {
		__callInfo = __queue[i];
		tag = utils.tagifyName(__callInfo.name);
		bot.speak('You\'re up, '+tag+'!');
		__callTimer = setTimeout(function () {
		    __callTimer = null;
		    __callInfo = null;

		    bot.speak('Sorry, '+tag+', you took too long!');
		    self.dequeue(__queue[i].id);
		    self.callNext();
		}, __callTime);
		break;
	    }
	}
    };

    this.cancelCall = function () {
	if (__callTimer !== null) {
	    clearTimeout(__callTimer);
	    __callTimer = null;
	}
	if (__callInfo !== null) {
	    __callInfo = null;
	}
    }
    
    this.enqueue = function (id, name) {
	var bot = self.getDep('bot');
	var utils = self.getDep('utils');
	var aways = self.getDep('aways');
	var spot = false;

	if (id === bot.userId) {
	    return __isBot;
	}
	if (utils.isDj(id)) {
	    return __isDj;
	}
	if ((spot = self.getQueuePosition(id)) !== false) {
	    return __isQueued;
	}
	if (aways.isAway(id, __isDj)) {
	    return __isAway;
	}

	__queue.push({
	    name: name,
	    id:   id });
	var eventData = {
	    id:   id,
	    size: self.getQueueSize(),
	    spot: self.getRealQueuePosition(id)};
//	self.emit('enqueue', eventData);
	return __success;
    };

    this.dequeue = function (id) {
	var spot = false;
	var realSpot = false;
	for (var i in __queue) {
	    if (__queue[i].id === id) {
		spot = i;
		realSpot = self.getRealQueuePosition(id);
		__queue.splice(i,1);
		break;
	    }
	}
	if (spot !== false) {
	    var eventData = {
		id: id,
		size: self.getQueueSize(),
		spot: realSpot
	    };
//	    self.emit('dequeue', eventData);
	}
	return spot;
    };

    this.moveInQueue = function (id, amount) {
	var utils = self.getDep('utils');
	var name = utils.getUserById(id).name;
	var isQueued = self.enqueue(id, name);
	var oldSpot, newSpot;

	if (isQueued === __isQueued || isQueued === __success) {
	    oldSpot = self.getQueuePosition(id);
	    newSpot = oldSpot+amount;
	    if (newSpot < 0) {
		newSpot = 0;
	    }
	    else if (newSpot >= self.getQueueSize()) {
		newSpot = self.getQueueSize()-1;
	    }
	    if (newSpot === oldSpot && isQueued !== __success) {
		return __zeroMove;
	    }

	    var qData = __queue.splice(oldSpot,1);
	    __queue.splice(newSpot,0,qData[0]);
	    return newSpot;
	}
	else {
	    return isQueued;
	}
    };

    this.printQueue = function () {
	var bot = self.getDep('bot');
	var aways = self.getDep('aways');
	var msg = '';
	const queueSize = self.getQueueSize();

	if (self.getQueueSize() === 0) {
	    msg = 'The queue is empty right now.';
	}
	else {
	    for (var i = 0; i < queueSize; i++) {
		var user = __queue[i];

		msg += (i+1)+' - ';
		if (aways.isAway(user.id, __isQueued)) {
		    msg += '(x)'.replace('x',user.name);
		}
		else {
		    msg += user.name;
		}
		if (i < queueSize-1) {
		    msg += ', ';
		}
	    }
	}

	bot.speak(msg);
    };

    this.printSpot = function (id) {
	var bot = self.getDep('bot');
	var aways = self.getDep('aways');
	var utils = self.getDep('utils');
	var spot = self.getRealQueuePosition(id);
	var name = utils.getUserById(id).name;

	if (spot === false) {
	    bot.speak('You\'re not on the queue, '+name);
	}
	else if (spot === 0) {
	    bot.speak('You\'re next in line, '+name+' :)');
	}
	else if (spot === 1) {
	    bot.speak('There\'s 1 person in front of you, '+name+'!');
	}
	else {
	    bot.speak('There are '+spot+' people in front of you, '+name);
	}
    };

    this.getQueueSize = function () {
	return __queue.length;
    }
}

module.exports = Queue;