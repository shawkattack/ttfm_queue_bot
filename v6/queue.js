var QueueModule = require('./proto/queue.js');

// TODO finish queue calls
// TODO add away management

var Queue = function (depList) {
    var self = this;

    var __queue = [];
    var __callTimer = null;
    var __callInfo = null;

    const __callTime = 40*1000;

    const __isDj = 'isDj';
    const __isAway = 'isAway';
    const __isQueued = 'isQueued';
    const __isBot = 'isBot';
    const __zeroMove = 'zeroMove';
    const __success = true;

    QueueModule.call(this,['utils','aways','kicks','limits']);
    this.addDependencies(depList);

    this.init = function () {
	var bot = self.getDep('bot');
	var utils = self.getDep('utils');
	bot.on('speak', function (data) {
	    var reData = null;
	    var tag = utils.tagify(data.name);
	    if (utils.isMod(data.userid)) {
		if ((reData = data.text.match(/^ *\/?q([+-][0-9]+) +(\S.*?) *$/i))) {
		    var amt = -parseInt(reData[1], 10);
		    var uData = utils.getUserByTag(reData[2]);
		    if (!uData) {
			bot.speak('Sorry, I can\'t find that user!');
			return;
		    }
		    var oldSpot = self.getRealQueuePosition(uData.id);
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
			newSpot = self.getRealQueuePosition(uData.id);
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
		    msg = 'I\'ve added you to the queue, '+tag+' :)';
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
        for (var i in __queue) {
	    if (__queue[i].id === id) {
		return i;
	    }
	}
	return false;
    };

    // Assumes ignoreList is a js Object mapping userids to other Objects
    this.getRealQueuePosition = function (id, ignoreList) {
	var idx = 0;
        for (var i = 0; i < self.getQueueSize(); i++) {
	    if (__queue[i].id === id) {
		return idx;
	    }
	    if (!ignoreList(__queue[i].id)) {
		idx++;
	    }
	}
	return false;
    };

    this.callNext = function () {
	var bot = self.getDep('bot');
	var utils = self.getDep('utils');
	var aways = self.getDep('aways');
	
	self.cancelCall();
	for (var i = 0; i < self.getQueueSize(); i++) {
	    if (!aways.isAway(__queue[i].id)) {
		var tag = utils.tagifyName(__callInfo.name);
		__callInfo = __queue[i];
		bot.speak('You\'re up, '+tag+'!');
		__callTimer = setTimeout(function () {
		    __callTimer = null;
		    __callInfo = null;

		    bot.speak('Sorry, '+tag+', you took too long!');
		    self.callNext();
		}, __callTime);
	    }
	}
    };

    this.cancelCall = function () {
	if (__callTimer !== null) {
	    clearTimeour(__callTimer);
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

	__queue.push(
	    {name: name,
	     id:   id });
	return __success;
    };

    this.dequeue = function (id) {
	var spot = false;
	for (var i in __queue) {
	    if (__queue[i].id === id) {
		spot = i;
		__queue.splice(i,1);
		break;
	    }
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
	    __queue.splice(newSpot,0,qData);
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
	var spot = self.getRealQueuePosition(id, aways.getAways(__isQueued));

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

module.exports = QueueModule;