var KicksModule = require('./proto/kicks.js');

var Kicks = function(depList) {
    var self = this;

    const __onQueue = 'onQueue';
    const __afterX = 'afterX';
    const __isDj = 'isDj';

    var __kickList = {};
    __kickList[__onQueue] = {};
    __kickList[__afterX] = {};
    var __toKick = null;

    KicksModule.call(this, ['queue', 'utils', 'aways']);
    this.addDependencies(depList);
    this.addHelp({
        'kick me': 'Type kick me, and I\'ll remove you after your next song. ' + 'For a full options listing, check http://purednb.com/queue-commands/',
        'cancel': 'Type cancel kick me, and I\'ll remove any kick-mes you\'ve ' + 'requested :)'
    });

    this.reset = function() {
        __toKick = null;
        __kickList = {};
        __kickList[__onQueue] = {};
        __kickList[__afterX] = {};
    };

    this.installHandlers = function() {
        var bot = self.getDep('bot');
        var queue = self.getDep('queue');
        var utils = self.getDep('utils');
        var aways = self.getDep('aways');

        queue.on('enqueue', function(data) {
            self.findQueueKickme(data.realSpot + 1);
        });

        queue.on('dequeue', function(data) {
            self.findQueueKickme(data.realSize);
        });

        bot.on('endsong', function(data) {
            var id = data.room.metadata.current_dj;
            if (typeof __kickList[__afterX][id] === 'number') {
                __kickList[__afterX][id]--;
                if (__kickList[__afterX][id] <= 0) {
                    utils.safeRemove(id);
                }
            }
        });
        bot.on('newsong', function(data) {
            if (__toKick !== null) {
                utils.safeRemove(__toKick);
                __toKick = null;
            }
        });

        // TODO debug?
        aways.on('rem_dj', function(data) {
            self.removeKick(data.user[0].userid);
        });

        bot.on('speak', function(data) {
            var reData = null;
            var id = data.userid;
            var verb;
            if ((reData = data.text.match(/^ *\/?(kick|boot|escort|remove) *me +cancel *$/i)) || (reData = data.text.match(/^ *\/?cancel +(kick|boot|escort|remove)(?: *me) *$/i))) {
                var result = self.removeKick(id);
                verb = reData[1].toLowerCase();
                if (!result) {
                    bot.speak('You didn\'t ask me to ' + verb + ' you :P');
                    return;
                }
                else {
                    bot.speak('OK, I won\'t ' + verb + ' you any more :)');
                    return;
                }
            }
            else if ((reData = data.text.match(/^ *\/?(kick|boot|escort|remove) *me(.*)$/i))) {
                verb = reData[1].toLowerCase();
                if (!utils.isDj(id)) {
                    bot.speak('I can\'t ' + verb + ' you if you\'re not on the decks!');
                    return;
                }
                var options = reData[2];
                var onQueue = null;
                var afterX = null;
                reData = null;

                if (options !== undefined && !options.match(/^ *$/)) {
                    if (options.charAt(0) !== ' ') {
                        return;
                    }
                    options = options.split(' or');
                    for (var i in options) {
                        if ((reData = options[i].match(/^ +on +q(?:ueue)? *$/i))) {
                            if (onQueue !== null) {
                                continue;
                            }
                            else {
                                onQueue = 2;
                            }
                        }
                        else if ((reData = options[i].match(/^ +on +q(?:ueue)? *([0-9]+) *$/i))) {
                            if (onQueue !== null) {
                                continue;
                            }
                            else {
                                onQueue = parseInt(reData[1],10);
                                if (onQueue > 4) {
                                    onQueue = 4;
                                }
                                if (onQueue < 1) {
                                    onQueue = 1;
                                }
                            }
                        }
                        else if ((reData = options[i].match(/^ +(?:after|in) +([0-9]+) *$/i))) {
                            if (afterX !== null) {
                                continue;
                            }
                            else {
                                afterX = parseInt(reData[1],10);
                                if (afterX > 10) {
                                    afterX = 10;
                                }
                                if (afterX < 0) {
                                    afterX = 0;
                                }
                            }
                        }
                    }
                }
                else {
                    if (utils.getCurrentDj() === id) {
                        afterX = 0;
                    }
                    else {
                        afterX = 1;
                    }
                }

                if (onQueue === null && afterX === null) {
                    bot.speak('Something\'s not quite right there... :/');
                    return;
                }

                self.removeKick(id);
                var msg = 'OK, I\'ll ' + verb + ' you ';
                options = {};
                if (afterX !== null) {
                    if (afterX === 0) {
                        msg += 'after your song is over';
                    }
                    else if (afterX === 1) {
                        msg += 'after your next song';
                    }
                    else {
                        msg += 'after ' + afterX + ' more songs';
                    }

                    if (utils.getCurrentDj() === id) {
                        afterX++;
                    }
                    options[__afterX] = afterX;

                    if (onQueue !== null) {
                        msg += ' or ';
                    }
                }
                if (onQueue !== null) {
                    options[__onQueue] = onQueue;
                    if (onQueue === 1) {
                        msg += 'when someone queues up';
                    }
                    else {
                        msg += 'when ' + onQueue + ' people queue up';
                    }
                }
                msg += ' :)';
                self.addKick(id, options);
                if (self.findQueueKickme() === id) {
                    msg = 'WAZAM';
                }
                bot.speak(msg);
            }
        });
    };

    this.findQueueKickme = function(n) {
        var utils = self.getDep('utils');
        var queue = self.getDep('queue');
        var djs = utils.getDjs();
        var numSpots = utils.getNumSpots();
        var result = null;
        if (n === undefined) {
            n = queue.getRealQueueSize();
        }
        for (var i in djs) {
            var kickData = self.getKicks({
                id: djs[i],
                type: __onQueue
            });
            if (typeof kickData === 'number' && n - numSpots >= kickData) {
                if (djs[i] === utils.getCurrentDj()) {
                    __toKick = djs[i];
                    break;
                }
                else {
                    utils.safeRemove(djs[i]);
                    result = djs[i];
                    break;
                }
            }
        }
        return result;
    };

    this.addKick = function(id, options) {
        for (var type in options) {
            if (__kickList[type] !== undefined) {
                __kickList[type][id] = options[type];
                return true;
            }
            else return false;
        }
        return true;
    };

    this.removeKick = function(id) {
        var success = false;
        if (__kickList[__onQueue] && __kickList[__onQueue][id] !== undefined) {
            success = true;
            delete __kickList[__onQueue][id];
        }
        if (__kickList[__afterX] && __kickList[__afterX][id] !== undefined) {
            success = true;
            delete __kickList[__afterX][id];
        }
        if (id === __toKick) {
            __toKick = null;
            self.findQueueKickme();
        }
        return success;
    };

    this.getKicks = function(options) {
        var ret;
        if (!options.id && !options.type) {
            return undefined;
        }
        if (options.type && !options.id) {
            return __kickList[options.type];
        }
        if (options.id && !options.type) {
            ret = {};
            ret[__onQueue] = __kickList[__onQueue][options.id];
            ret[__afterX] = __kickList[__afterX][options.id];
            return ret;
        }
        ret = __kickList[options.type];
        if (!ret) {
            return ret;
        }
        return ret[options.id];
    };
};

module.exports = Kicks;