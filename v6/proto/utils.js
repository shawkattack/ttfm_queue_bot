var BotModule = require('./botmodule');
const moduleName = 'utils';

var UtilsModule = function (depList) {
    BotModule.call(this,['bot'],moduleName);
    this.addDependencies(depList);
    
    // Snags a song
    this.snagSong = function (songID) {
	var bot = this.getDep('bot');

	if (!songID) {
	    console.log('Error snagging song: No song playing!');
	    return;
	}
	bot.snag();
	bot.playlistAll(function (listData) {
	    // If the playlist is corrupt, there's nothing we can do
	    if (listData.err) {
		console.log(listData.err);
	    }
	    else {
		var idx = listData.list.length;
		bot.playlistAdd(songID, idx);
	    }
	});
    };
    
    // Turns a name into a tagged name for chat
    this.tagifyName = function (name) {
	if (typeof name !== 'string' || name === '') {
	    throw new Error('Cannot tagify non-name object.');
	}
	var tag = name.charAt(0) === '@' ? '' : '@';
	return tag+name;
    };
    
    // Gets the size of a js object/associative array
    this.objectSize = function (obj) {
	var count = 0;
	for (var i in obj) {
	    count++;
	}
	return count;
    };
    
    // ALL FOLLOWING FUNCTIONS ARE NOT IMPLEMENTED BY DEFAULT
    // Please implement these when you write your actual modules
    
    // Turns a tagged name into a non-tagged name
    this.untagifyName = function (tag) {
	return '';
    };
    this.untagifyName.override = true;
    
    // Gets info about a user by hex id
    this.getUserByID = function (id) {
	return undefined;
    };
    this.getUserByID.override = true;
    
    // Gets info about a user by their name
    this.getUserByName = function (name) {
	return undefined;
    };
    this.getUserByName.override = true;
    
    // Determines if a user is a moderator (by ID)
    this.isMod = function (id) {
	return false;
    };
    this.isMod.override = true;
    
    // Determines if a user is a DJ (by ID)
    this.isDJ = function (id) {
	return false;
    };
    this.isDJ.override = true;
    
    // Determines how to handle mod actions
    this.judgeMod = function (id) {
    };
    this.judgeMod.override = true;
    
    // Determines how to handle de-mod actions
    this.judgeDemod = function (id) {
    };
    this.judgeDemod.override = true;
    
    // Determines what to do with an oog vote
    this.countOOGVote = function (id) {
    }
    this.countOOGVote.override = true;
    
    // Determines how to vote
    this.doVote = function (voteData) {
    }
    this.doVote.override = true;

    // Get the max number of DJs
    this.getMaxDjs = function () {
	return 5;
    }
    this.getMaxDjs.override = true;

    // Get the current number of DJs
    this.getNumDjs = function () {
	return 0;
    }
    this.getNumDjs.override = true;
};

module.exports = UtilsModule;