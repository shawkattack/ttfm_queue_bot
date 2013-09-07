var UtilsModule = require('./proto/utils.js');

var Utils = function (depList) {
    var self = this;

    var __userListIN = {};
    var __userListNI = {};

    var __djList = [];
    var __maxDjs = 0;
    var __currentDj = null;

    var __oogVotes = {};
    var __oogWarned = false;
    var __oogKickTimeout = null;

    var __oogGraceTime = 5*1000;
    var __oogGraceTimeout = null;

    var __songTimer = null;
    var __stuckTimer = null;
    
    var __currentSong = null;
    var __hasVoted = false;
    var __modLockOn = false;

    var __botsKilled = 0;
    var __snagCounter = 0;
    
    const __upvoteThresh = 0.25;
    const __oogWarnThresh = 2;
    const __oogKickThresh = 3;
    const __oogKickTime = 15*1000;
    const __songLeeway = 7*1000;
    const __skipLeeway = 10*1000;

    const __isDj = 'isDj';
    
    UtilsModule.call(this,['queue','aways','kicks','vips']);
    this.addDependencies(depList);
    this.addHelp({
	'oog':'Type oog to mark the current song as \'out-of-genre\'. '+
	    'If enough people join you, I\'ll remove the problem :)'
    });
    
    var mod = function (id) {
	var bot = self.getDep('bot');
	var user = self.getUserById(id);
	if (!user) {
	    return;
	}
	user.mod = true;
	bot.addModerator(id);
    }
    var demod = function (id) {
	var bot = self.getDep('bot');
	var user = self.getUserById(id);
	if (!user) {
	    return;
	}
	delete user.mod;
	bot.remModerator(id);
    }

    this.reset = function () {
        var queue = self.getDep('queue');
        var aways = self.getDep('aways');
        var kicks = self.getDep('kicks');
	
        queue.reset();
        aways.reset();
        kicks.reset();
    };
    
    this.installHandlers = function () {
	var bot = self.getDep('bot');
	bot.on('roomChanged', function (data) {
	    if (!data.room) {
		console.log(data);
		return;
	    }
	    __djList = data.room.metadata.djs;
	    __maxDjs = data.room.metadata.max_djs;
	    __currentDj = data.room.metadata.current_dj;
	    __currentSong = data.room.metadata.current_song;
	    if (__currentSong) {
		__currentSong = __currentSong._id;
	    }
	    
	    var users = data.users;
	    for (var i in users) {
		var userObj = {
		    id:   users[i].userid,
		    name: users[i].name };
		__userListIN[userObj.id] = userObj;
		__userListNI[userObj.name.toLowerCase()] = userObj;
	    }
	    var mods = data.room.metadata.moderator_id;
	    for (var i in mods) {
		if (__userListIN[mods[i]]) {
		    __userListIN[mods[i]].mod = true;
		}
	    }
	    self.doVote(data.room.metadata);

	    if (self.getMaxDjs()-self.getNumSpots() < 2) {
		bot.addDj();
	    }
	});

	bot.on('snagged', function (data) {
	    __snagCounter++;
	});
	
	bot.on('newsong', function (data) {
	    clearTimeout(__oogKickTimeout);
	    __oogKickTimeout = null;
	    __oogVotes = {};
	    __oogWarned = false;
	    __currentSong = data.room.metadata.current_song._id;
	    __currentDj = data.room.metadata.current_dj;
	    __hasVoted = false;
	    
	    if (__songTimer) {
		clearTimeout(__songTimer);
		__songTimer = null;
	    }
	    if (__stuckTimer) {
		clearTimeout(__stuckTimer);
		__stuckTimer = null;
		bot.speak('Thank you! :)');
	    }
	    var songLength = data.room.metadata.current_song.metadata.length*1000;
	    __songTimer = setTimeout(function () {
		__songTimer = null;
		if (__currentDj === bot.userId) {
		    bot.speak('I think I might be stuck :(');
		}
		else {
		    var user = self.getUserById(__currentDj);
		    if (!user) {
			__songTimer = null;
			return;
		    }
		    var name = self.tagifyName(user.name);
		    bot.speak('Hey, '+name+', you\'re stuck! Please skip!');
		}
		__stuckTimer = setTimeout(function () {
		    __stuckTimer = null;
		    if (__currentDj === bot.userId) {
			bot.speak('Sorry about that :P');
			bot.stopSong();
		    }
		    else {
			self.safeRemove(__currentDj);
		    }
		}, __skipLeeway);
	    }, songLength+__songLeeway);

	    if (__oogGraceTimeout) {
		clearTimeout(__oogGraceTimeout);
	    }
	    __oogGraceTimeout = setTimeout(function () {
		__oogGraceTimeout = null;
	    },__oogGraceTime);

	    __snagCounter = 0;
	});

	bot.on('endsong', function (data) {
	    if (self.getMaxDjs()-self.getNumSpots() >= 3) {
		bot.remDj(bot.userId);
	    }
	    bot.speak(data.room.metadata.current_song.metadata.song + " got :arrow_up: " +
		      data.room.metadata.upvotes + " :arrow_down: " +  data.room.metadata.downvotes +
		      " :hearts: " + __snagCounter );

	});
	bot.on('add_dj', function (data) {
	    var id = data.user[0].userid;
		
		// CONSISTENCY CHECK that works in conjunction with user registration safeguard
		var idx = self.isDj(id);
		if (idx !== false) {
		__djList.splice(idx,1);
		}
		// END CONSISTENCY CHECK
		
	    __djList.push(id);
		
	    if (__currentDj != bot.userId && self.getMaxDjs()-self.getNumSpots() >= 3) {
		bot.remDj(bot.userId);
	    }
	});
	bot.on('rem_dj', function (data) {
	    var id = data.user[0].userid;
	    var idx = self.isDj(id);
	    if (idx !== false) {
		__djList.splice(idx,1);
	    }
	    if (self.getMaxDjs()-self.getNumSpots() < 2) {
		bot.addDj();
	    }
	});

	bot.on('registered', function (data) {
	    var userObj = {
		name: data.user[0].name,
		id:   data.user[0].userid };
	    __userListIN[userObj.id] = userObj;
	    __userListNI[userObj.name.toLowerCase()] = userObj;
		
		// SAFEGUARD that makes sure the dj list stays synced when new people enter
		// Code in add_dj handler should keep ordering consistent, so this only needs to check length
		tempDjList = data.room.metadata.djs;
		if (__djList.length != tempDjList.length) {
			__djList = tempDjList;
		}
		// END SAFEGUARD

	    if (data.user[0].name.match(/^@ttstats_[0-9]+$/)) {
		bot.boot(data.user[0].userid, (++__botsKilled)+' bots down!');
		return;
	    }

	    if (!self.isMod(userObj.id)) {
		bot.roomInfo(false, function (data2) {
		    if (!data2.room) {
			console.log(data2);
		    }
		    var mods = data2.room.metadata.moderator_id;
		    for (var i in mods) {
			if (mods[i] === userObj.id) {
			    userObj.mod = true;
			    break;
			}
		    }
		});
	    }
	});
	bot.on('deregistered', function (data) {
	    var id = data.user[0].userid;
	    var name = data.user[0].name;
	    delete __userListIN[id];
	    delete __userListNI[name.toLowerCase()];
	});
	bot.on('update_user', function (data) {
	    if (data.name) {
		var udata = self.getUserById(data.userid);
		if (data.name !== udata.name) {
		    __userListNI[udata.name.toLowerCase()] = undefined;
		    udata.name = data.name;
		    __userListNI[data.name.toLowerCase()] = udata;
		}
	    }
	});
	
	bot.on('new_moderator', function (data) {
	    self.judgeMod(data.userid);
	});
	bot.on('rem_moderator', function (data) {
	    self.judgeDemod(data.userid);
	});
	
	bot.on('update_votes', function (data) {
	    self.doVote(data.room.metadata);
	});

	bot.on('pmmed', function (data) {
	    var sender = data.senderid;
	    if (self.isMod(sender)) {
		var reData = null;
		if ((reData = data.text.match(/^ *\/?mod +(\S.*?) *$/i))) {
		    var user = self.getUserByTag(reData[1]);
		    if (!user) {
			bot.pm('Sorry, I can\'t find that user!',sender);
			return;
		    }
		    else if (user.id === bot.userId) {
			bot.pm('Nice try, but I\'m INVINCIBLE! Muahahahaha >:D',sender);
			return;
		    }
		    mod(user.id);
		    bot.pm('Alright, you\'re the bawss! :D',sender);
		}

		else if ((reData = data.text.match(/^ *\/?demod +(\S.*?) *$/i))) {
		    var user = self.getUserByTag(reData[1]);
		    if (!user) {
			bot.pm('Sorry, I can\'t find that user!',sender);
			return;
		    }
		    else if (user.id === bot.userId) {
			bot.pm('Nice try, but I\'m INVINCIBLE! Muahahahaha >:D',sender);
			return;
		    }
		    demod(user.id);
		    bot.pm('Alright... you\'re the bawss :/',sender);
		}

		else if ((reData = data.text.match(/^ *\/?lock *mods *$/i)) ||
			 (reData = data.text.match(/^ *\/?set +mod *lock +on *$/i))) {
		    self.lockMods();
                    bot.pm('Okie dokie, I\'ll lock down mods and demods',sender);
		}

		else if ((reData = data.text.match(/^ *\/?unlock *mods *$/i)) ||
			 (reData = data.text.match(/^ *\/?set +mod *lock +off *$/i))) {
		    self.unlockMods();
                    bot.pm('Mods and demods are in your hands again!',sender);
		}
                else if ((reData = data.text.match(/^ *\/?snag *$/i))) {
                    self.snag();
                }
	    }
	});
	bot.on('speak', function (data) {
	    var sender = data.userid;
	    var reData = null;
	    if (self.isMod(sender)) {
		if ((reData = data.text.match(/^ *\/?\.s *$/i))) {
		    self.countOOGVote(sender, true);
		}
                if ((reData = data.text.match(/^ *\/?(?:oog +cancel|cancel +oog) *$/i))) {
                    self.cancelOOG();
                }
	    }

	    if ((reData = data.text.match(/^ *\/?oog *$/i))) {
		self.countOOGVote(sender, false);
	    }
	});
    };

    this.snag = function () {
	self.snagSong(__currentSong);
    };
    
    this.untagifyName = function (tag) {
	// If the first character isn't an @, or if the user has an @ in their
	// name, just return the name
	if (tag.charAt(0) !== '@' || self.getUserByName(tag)) {
	    return tag;
	}
	// Otherwise, remove the @ tag
	else {
	    return tag.substring(1);
	}
    };

    this.getUserById = function (id) {
	return __userListIN[id];
    };

    this.getUserByName = function (name) {
	return __userListNI[name.toLowerCase()];
    };

    this.getUserByTag = function (name) {
	return self.getUserByName(self.untagifyName(name));
    };

    this.refreshUserList = function (callback) {
        var bot = self.getDep('bot');
        bot.roomInfo(false, function (data) {
            var users = data.users;
            for (var i in users) {
                var userObj = {
                    id:   users[i].userid,
                    name: users[i].name };
                __userListIN[userObj.id] = userObj;
                __userListNI[userObj.name.toLowerCase()] = userObj;
            }
            var mods = data.room.metadata.moderator_id;
            for (var i in mods) {
                if (__userListIN[mods[i]]) {
                    __userListIN[mods[i]].mod = true;
                }
            }
            
            callback();
        });
    }

    this.isMod = function (id) {
	// Extra logic to return false in case other devs are type-obsessive
	var user = null;
	if (!(user = self.getUserById(id)) || !(user.mod)) {
	    return false;
	}
	return true;
    };
    
    this.isDj = function (id) {
	for (var i in __djList) {
	    if (__djList[i] === id) {
		return i;
	    }
	}
	return false;
    };

    this.lockMods = function () {
	__modLockOn = true;
    };
    this.unlockMods = function () {
	__modLockOn = false;
    };

    this.judgeMod = function (id) {
	var bot = self.getDep('bot');
	var user = self.getUserById(id);
	if (!user) {
	    // If the user data is missing, we can't do anything
	    return;
	}
	if (!__modLockOn) {
	    // If mod lock is off, record the event
	    user.mod = true;
	}
	else {
	    // Otherwise, re-de-mod the user
	    if (!user.mod) {
		bot.remModerator(id);
	    }
	}
    };
    this.judgeDemod = function (id) {
	var bot = self.getDep('bot');
	var user = self.getUserById(id);
	if (!user) {
	    // If the user data is missing, we can't do anything
	    return;
	}
	if (!__modLockOn) {
	    // If mod lock is off, record the event
	    delete user.mod;
	}
	else {
	    // Otherwise, re-mod the user
	    if (user.mod) {
		bot.addModerator(id);
	    }
	}
    };

    this.countOOGVote = function (id, warn) {
	var bot = self.getDep('bot');
        var vips = self.getDep('vips');

        if (vips.isVip(id)) {
            return;
        }
        if (__oogGraceTimeout !== null) {
            return;
        }

	__oogVotes[id] = true;
	var numVotes = self.objectSize(__oogVotes);
	if (numVotes >= __oogKickThresh) {
	    self.safeRemove(__currentDj);
	    return;
	}

	if (numVotes >= __oogWarnThresh || warn) {
	    if (!__oogWarned) {
		__oogWarned = true;
		bot.speak('This sounds out of genre. Please skip!');
	    }
	}
	if (numVotes >= __oogWarnThresh && __oogKickTimeout === null) {
	    __oogKickTimeout = setTimeout(function () {
		self.safeRemove(__currentDj);
		__oogKickTimeout = null;
	    }, __oogKickTime);
	}
    };

    this.cancelOOG = function () {
        var bot = self.getDep('bot');

        if (__oogGraceTimeout) {
            clearTimeout(__oogGraceTimeout);
        }
        if (__oogKickTimeout) {
            clearTimeout(__oogKickTimeout);
        }
        __oogGraceTimeout = {};
        bot.speak('OK, OOG flags have been disabled for this song!');
        bot.vote('up');
    };

    this.doVote = function (voteData) {
	var upvotes = voteData.upvotes;
	var downvotes = voteData.downvotes;
	var numUsers = voteData.listeners;
	var bot = self.getDep('bot');
	
	// If the oog vote has already kicked in, ignore
	if (__oogKickTimeout) {
	    return;
	}
	if (upvotes >= __upvoteThresh*(self.getNumUsers()-1)) {
	    bot.vote('up');
	    __hasVoted = true;
	}
	else if (__hasVoted && downvotes >= upvotes) {
	    bot.vote('down');
	}
    };

    this.getDjs = function () {
        return __djList;
    }
    this.getMaxDjs = function () {
	return __maxDjs;
    }    
    this.getNumDjs = function () {
	return __djList.length;
    };
    this.getNumSpots = function () {
	var aways = self.getDep('aways');
        var djAways = aways.getAways(__isDj);
        var numAwayDjs = self.objectSize(djAways);
        for (var i in __djList) {
            if (djAways[__djList[i]]) {
                numAwayDjs--;
            }
        }
	return self.getMaxDjs()-self.getNumDjs()-
	    numAwayDjs;
    }
    this.getNumUsers = function () {
	return self.objectSize(__userListIN);
    };
    this.getCurrentDj = function () {
	return __currentDj;
    };

    this.safeRemove = function (id) {
	var bot = self.getDep('bot');
	var aways = self.getDep('aways');
	var kicks = self.getDep('kicks');

	aways.removeAways(id);
	kicks.removeKick(id);
	bot.remDj(id);
    };
};

module.exports = Utils;