var BotModule = require('./botmodule');
const moduleName = 'Utils';

var UtilsModule = function (dependencies, requiredDependencies) {
    var dependencies = arguments[0];
    var requiredDependencies = arguments[1];
    this.dependencies = dependencies;
    this.requiredDependencies = ['bot'];
    if (requiredDependencies !== undefined && requiredDependencies !== null) {
	this.requiredDependencies = this.requiredDependencies.concat(requiredDependencies);
    }
};
UtilsModule.prototype = new BotModule(UtilsModule.prototype.dependencies,
				      UtilsModule.prototype.requiredDependencies);

// Snags the current song
UtilsModule.prototype.snag = function (songID) {
    console.log(this.dependencies);
    if (!songID) {
	console.log('Error snagging song: No song playing!');
	return;
    }
    dependencies.bot.snag();
    dependencies.bot.playlistAll(function (listData) {
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
UtilsModule.prototype.tagifyName = function (name) {
    if (typeof name !== 'string' || name === '') {
	throw new Error('Cannot tagify non-name object');
    }
    var tag = name.charAt(0) === '@' ? '' : '@';
    return tag+name;
};

// Gets the size of a js object/associative array
UtilsModule.prototype.objectSize = function (obj) {
    var count = 0;
    for (var i in obj) {
	count++;
    }
    return count;
};

// ALL FOLLOWING FUNCTIONS ARE NOT IMPLEMENTED BY DEFAULT
// Please implement these when you write your actual modules

// Turns a tagged name into a non-tagged name
UtilsModule.prototype.untagifyName = function (tag) {
    return '';
};
UtilsModule.prototype.untagifyName.override = true;

// Gets info about a user by hex id
UtilsModule.prototype.getUserByID = function (id) {
    return undefined;
};
UtilsModule.prototype.getUserByID.override = true;

// Gets info about a user by their name
UtilsModule.prototype.getUserByName = function (id) {
    return undefined;
};
UtilsModule.prototype.getUserByName.override = true;

// Determines if a user is a moderator (by ID)
UtilsModule.prototype.isMod = function (id) {
    return false;
};
UtilsModule.prototype.isMod.override = true;

// Determines if a user is a DJ (by ID)
UtilsModule.prototype.isDJ = function (id) {
    return false;
};
UtilsModule.prototype.isDJ.override = true;

// Determines how to handle mod actions
UtilsModule.prototype.judgeMod = function (id) {
};
UtilsModule.prototype.judgeMod.override = true;

// Determines how to handle de-mod actions
UtilsModule.prototype.judgeDemod = function (id) {
};
UtilsModule.prototype.judgeDemod.override = true;

// Determines what to do with an oog vote
UtilsModule.prototype.countOOGVote = function (id) {
}
UtilsModule.prototype.countOOGVote.override = true;

// Determines how to vote
UtilsModule.prototype.doVote = function (voteData) {
}
UtilsModule.prototype.doVote.override = true;

module.exports = UtilsModule;