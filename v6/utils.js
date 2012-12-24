var UtilsModule = require('./proto/utils.js');

var Utils = function (depList) {
    var __userListIN = {};
    var __userListNI = {};

    var __djList = [];
    var __maxDjs = 0;
    var __currentDj = null;

    var __oogVotes = {};
    var __oogWarned = false;
    var __oogKickTimeout = null;
    
    var __currentSong = null;
    var __hasVoted = false;
    var __modLockOn = false;
    
    const __upvoteThresh = 0.25;
    const __oogWarnThresh = 2;
    const __oogKickThresh = 3;
    const __oogKickTime = 15*1000;
    
    UtilsModule.call(this,['aways']);
    this.addDependencies(depList);
    
    var mod = function (id) {
	var bot = this.getDep('bot');
	var user = this.getUserById(id);
	if (!user) {
	    return;
	}
	user.mod = true;
	bot.addModerator(id);
    }
    var demod = function (id) {
	var bot = this.getDep('bot');
	var user = this.getUserById(id);
	if (!user) {
	    return;
	}
	delete user.mod;
	bot.remModerator(id);
    }
    
    this.init = function () {
	var bot = this.getDep('bot');
	bot.on('roomChanged', function (data) {
	    __djList = data.room.metadata.djs;
	    __maxDjs = data.room.metadata.max_djs;
	    __currentDj = data.room.metadata.current_dj;
	    __currentSong = data.room.metadata.currentSong;
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
		__userListIN[userObj.id].mod = true;
	    }
	});
	
	bot.on('newsong', function (data) {
	    cancelTimeout(__oogKickTimeout);
	    __oogKickTimeout = null;
	    __oogVotes = {};
	    __oogWarned = false;
	    __currentSong = data.room.metadata.current_song._id;
	    __currentDj = data.room.metadata.current_dj;
	    __hasVoted = false;
	});

	bot.on('add_dj', function (data) {
	    var id = data.user[0].userid;
	    __djList.push(id);
	});
	bot.on('rem_dj', function (data) {
	    var id = data.user[0].userid;
	    var idx = this.isDJ(id);
	    if (idx !== false) {
		__djList.splice(idx,1);
	    }
	});
	
	bot.on('new_moderator', function (data) {
	    this.judgeMod(data.userid);
	});
	bot.on('rem_moderator', function (data) {
	    this.judgeDemod(data.userid);
	});
	
	bot.on('update_votes', function (data) {
	    this.doVote(data.room.metadata);
	});

	bot.on('pmmed', function (data) {
	    var sender = data.senderid;
	    if (this.isMod(sender)) {
		var reData = null;
		if ((reData = data.text.match(/^ *mod +(\S.*?) *$/i))) {
		    var user = getUserByTag(reData[1]);
		    if (!user) {
			bot.pm('Sorry, I can\'t find that user!',sender);
		    }
		    mod(user.id);
		}

		else if ((reData = data.text.match(/^ *demod +(\S.*?) *$/i))) {
		    var user = getUserByTag(reData[1]);
		    if (!user) {
			bot.pm('Sorry, I can\'t find that user!',sender);
		    }
		    demod(user.id);
		}

		else if ((reData = data.text.match(/^ *lock *mods *$/i)) ||
			 (reData = data.text.match(/^ *set +mod *lock +off *$/i))) {
		    this.lockMods();
		}

		else if ((reData = data.text.match(/^ *unlock *mods *$/i)) ||
			 (reData = data.text.match(/^ *set +mod *lock +on *$/i))) {
		    this.unlockMods();
		}
	    }
	});
	bot.on('speak', function (data) {
	    var sender = data.userid;
	    var reData = null;
	    if (this.isMod(sender)) {
		if ((reData = data.text.match(/^ +\.s +$/i))) {
		    this.countOOGVote(sender, true);
		}
	    }

	    if ((reData = data.text.match(/^ +oog +$/i))) {
		this.countOOGVote(sender, false);
	    }
	});
    };
    
    this.snag = function () {
	this.snagSong(__currentSong);
    };
    
    this.untagifyName = function (tag) {
	// If the first character isn't an @, or if the user has an @ in their
	// name, just return the name
	if (tag.charAt(0) !== '@' || this.getUserByName(tag)) {
	    return tag;
	}
	// Otherwise, remove the @ tag
	else {
	    return tag.substring(1);
	}
    };

    this.getUserByID = function (id) {
	return __userListIN[id];
    };

    this.getUserByName = function (name) {
	return __userListNI[name.toLowerCase()];
    };

    this.getUserByTag = function (name) {
	return this.getUserByName(this.untagifyName(name));
    };

    this.isMod = function (id) {
	// Extra logic to return false in case other devs are type-obsessive
	var user = null;
	if (!(user = getUserById(id)) && !(user.mod)) {
	    return false;
	}
	return true;
    };
    
    this.isDJ = function (id) {
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
	var bot = this.getDep('bot');
	var user = this.getUserById(id);
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
	var bot = this.getDep('bot');
	var user = this.getUserById(id);
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
	var bot = this.getDep('bot');

	__oogVotes[id] = true;
	var numVotes = this.objectSize(__oogVotes);
	if (numVotes > __oogKickThresh) {
	    bot.remDj(__currentDj);
	    return;
	}

	if (numVotes > __oogWarnThresh || warn) {
	    if (!__oogWarned) {
		__oogWarned = true;
		bot.speak('This sounds out of genre. Please skip!');
	    }
	}
	if (numVotes > __oogWarnThresh && __oogKickTimeout === null) {
	    __oogKickTimeout = setTimeout(function () {
		bot.remDj(__currentDj);
		__oogKickTimeout = null;
	    }, __oogKickTime);
	}
    };

    this.doVote = function (voteData) {
	var upvotes = voteData.upvotes;
	var downvotes = voteData.downvotes;
	var numUsers = voteData.listeners;
	var bot = this.getDep('bot');
	
	// If the oog vote has already kicked in, ignore
	if (__oogKickTimeout) {
	    return;
	}
	if (upvotes >= __upvoteThresh) {
	    bot.vote('up');
	    __hasVoted = true;
	}
	else if (__hasVoted && downvotes >= upvotes) {
	    bot.vote('down');
	}
    };

    this.getMaxDjs = function () {
	return __maxDjs;
    }    
    this.getNumDjs = function () {
	return __djList.length;
    };
    this.getNumSpots = function () {
	var ans = this.getMaxDjs()-this.getNumDjs();
	var aways = this.getDep('aways');
	if (aways && aways.getNumDjAways) {
	    ans -= aways.getNumDjAways();
	}
	return ans;
    }
    this.getNumUsers = function () {
	return this.objectSize(__userListIN);
    };
};

module.exports = Utils;