var LimitModule = require('./proto/limit.js');

var Limit = function(depList) {
    var self = this;

    var __limit = null;
    var __songCounts = {};
    var __kickTimers = {};

    const __kickTime = 30 * 1000;

    var clearTimer = function(id) {
        clearTimeout(__kickTimers[id]);
        delete __kickTimers[id];
    };
    var clearAllTimers = function() {
        for (var id in __kickTimers) {
            clearTimer(id);
        }
    };
    LimitModule.call(this, ['utils', 'aways', 'vips', 'queue']);
    this.addDependencies(depList);
    this.addHelp({
        'limit': 'Type limit to see the current song limit'
    });

    this.installHandlers = function() {
        var bot = self.getDep('bot');
        var utils = self.getDep('utils');
        var aways = self.getDep('aways');
        var vips = self.getDep('vips');
        var queue = self.getDep('queue');

        bot.on('roomChanged', function(data) {
            var djs = data.room.metadata.djs;
            for (var i in djs) {
                __songCounts[djs[i]] = 0;
            }
        });

        aways.on('add_dj', function(data) {
            var id = data.user[0].userid;
            __songCounts[id] = 0;
        });

        aways.on('rem_dj', function(data) {
            var id = data.user[0].userid;
            delete __songCounts[id];
            if (utils.getNumSpots() - queue.getQueueSize() >= 0) {
                self.reset();
            }
        });

        queue.on('dequeue', function(data) {
            if (utils.getNumSpots() - queue.getQueueSize() >= 0) {
                self.reset();
            }
        });

        bot.on('endsong', function(data) {
            var count;
            var currentDj = data.room.metadata.current_dj;
            var user = utils.getUserById(currentDj);
            var tag = user ? utils.tagifyName(user.name) : '';
            count = ++(__songCounts[currentDj]);
            if (__limit && count >= __limit && !vips.isVip(currentDj)) {
                if (user) {
                    bot.speak('Alright, ' + tag + ', you\'ve played your ' + __limit + ' songs. Time to step down!');
                    __kickTimers[currentDj] = setTimeout(function() {
                        utils.safeRemove(currentDj);
                    }, __kickTime);
                }
                else {
                    utils.refreshUserList(function() {
                        var innerUser = utils.getUserById(currentDj);
                        if (!user) {
                            return;
                        }
                        var innerTag = utils.tagifyName(innerUser.name);
                        bot.speak('Alright, ' + innerTag + ', you\'ve played your ' + __limit + ' songs. Time to step down!');
                        __kickTimers[currentDj] = setTimeout(function() {
                            utils.safeRemove(currentDj);
                        }, __kickTime);
                    });
                }
            }
        });

        bot.on('pmmed', function(data) {
            var sender = data.senderid;
            var reData = null;
            if (utils.isMod(sender)) {
                if ((reData = data.text.match(/^ *\/?set +limit +([0-9])+ *$/i))) {
                    if (utils.getNumSpots() - queue.getQueueSize() >= 0) {
                        bot.pm('There aren\'t enough people for me to impose a limit :/', sender);
                        return;
                    }
                    self.setLimit(parseInt(reData[1],10));
                    if (__limit) {
                        bot.speak('There is now a song limit of ' + __limit + ' in place!');
                    }
                    else {
                        bot.speak('The song limit has been lifted! Play as much as you want :)');
                    }
                }
                else if ((reData = data.text.match(/^ *\/?clear +limit *$/i))) {
                    bot.speak('The song limit has been lifted! Play as much as you want :)');
                    self.clearLimit();
                }
            }
        });

        bot.on('speak', function(data) {
            var reData = null;
            if ((reData = data.text.match(/^ *\/?(?:is +there +(?:a +)?)?(?:song +)?limit(?: +(?:in +)?here)? *\?? *$/i))) {
                if (!__limit) {
                    bot.speak('There\'s no song limit at the moment :)');
                }
                else {
                    bot.speak('The song limit is currently ' + __limit);
                }
            }
        });
    };

    this.setLimit = function(n) {
        if (typeof n != 'number' || n <= 0) {
            __limit = null;
            clearAllTimers();
        }
        else {
            if (n > 4) {
                __limit = 4;
            }
            else {
                __limit = n;
            }
        }
    };

    this.clearLimit = function() {
        self.setLimit(0);
    };

    this.reset = this.clearLimit;
};

module.exports = Limit;