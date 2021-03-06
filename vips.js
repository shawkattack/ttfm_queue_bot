var VipsModule = require('./proto/utils.js');

var Vips = function(depList) {
    var self = this;

    var __vipMode = false;
    var __vipList = {};
    var __kickList = {};

    var addKickTimer;
    var clearKickTimer;

    const __kickTime = 20 * 1000;
    const __kickInc = 5 * 1000;


    VipsModule.call(this, ['utils']);
    this.addDependencies(depList);
    this.addHelp({
        'vips': 'Prints a list of all vips.'
    });

    this.installHandlers = function() {
        var bot = this.getDep('bot');
        var utils = this.getDep('utils');

        addKickTimer = function(id, n) {
            __kickList[id] = setTimeout(function() {
                bot.remDj(id);
            }, __kickTime + __kickInc * n);
        };
        clearKickTimer = function(id) {
            clearTimeout(__kickList[id]);
        };

        bot.on('update_user', function(data) {
            var name = data.name;
            var id = data.userid;
            if (name) {
                if (__vipList[id] && __vipList[id] !== name) {
                    __vipList[id] = name;
                }
            }
        });

        bot.on('registered', function(data) {
            var name = data.user[0].name;
            var id = data.user[0].userid;
            if (__vipList[id] && __vipList[id] !== name) {
                __vipList[id] = name;
            }
            if (__vipMode && !__vipList[id]) {
                bot.pm('Hi there, we\'re in VIP mode right now! Only VIPs can DJ,' + ' so sit back and enjoy the music!', id);
            }
        });

        bot.on('add_dj', function(data) {
            var id = data.user[0].userid;
            if (__vipMode && !__vipList[id] && id !== bot.userId) {
                bot.remDj(id);
                bot.pm('Sorry, we\'re in VIP mode right now! Sit back and ' + 'enjoy the tunes :)', id);
            }
        });

        bot.on('pmmed', function(data) {
            var reData = null;
            var sender = data.senderid;
            var msg, target;
            if (utils.isMod(sender)) {
                if ((reData = data.text.match(/^ *\/?(?:set +)?vip *mode +on *$/i))) {
                    if (__vipMode) {
                        bot.pm('We\'re already in VIP mode!', sender);
                    }
                    else {
                        self.setVipMode();
                        bot.remDj(bot.userId);
                        msg = 'WARNING! VIP mode has been activated! ';
                        var n = 0;
                        var djs = utils.getDjs();
                        for (var i in djs) {
                            if (!__vipList[djs[i]] && djs[i] !== bot.userId) {
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
                        bot.pm('We\'re already out of VIP mode!', sender);
                    }
                    else {
                        self.unsetVipMode();
                        bot.speak('VIP mode has been deactivated. ' + 'Thanks, everyone! :)');
                    }
                }
                else if ((reData = data.text.match(/^ *\/?vip +(\S.*?) *$/i))) {
                    target = utils.getUserByTag(reData[1]);
                    if (!target) {
                        bot.pm('Sorry, I can\'t find that user :(', sender);
                    }
                    else if (target.id === bot.userId) {
                        bot.pm('Don\'t worry, I\'ve got myself covered ;)');
                    }
                    else if (self.addVip(target.id)) {
                        bot.pm('Alright, ' + target.name + ' is now a VIP :)', sender);
                    }
                }
                else if ((reData = data.text.match(/^ *\/?unvip +(\S.*?) *$/i))) {
                    target = utils.getUserByTag(reData[1]);

                    // If the user isn't in the room, try to find them on the VIP list
                    if (!target) {
                        var lcName = reData[1].toLowerCase();
                        for (var id in __vipList) {
                            if (lcName == __vipList[id].toLowerCase()) {
                                target = {
                                    name: __vipList[id],
                                    id: id
                                };
                                break;
                            }
                        }
                    }
                    if (!target) {
                        bot.pm('Sorry, I can\'t find that user on the list :(', sender);
                    }
                    else if (self.removeVip(target.id)) {
                        bot.pm('Alright, ' + target.name + ' is no longer a VIP :(', sender);
                        msg = 'Sorry, ' + utils.tagifyName(target.name) + ', you\'re no longer a VIP. Please step down!';
                        if (utils.isDj(target.id)) {
                            addKickTimer(target.id, 0);
                            bot.speak(msg);
                        }
                    }
                }
                else if ((reData = data.text.match(/^ *\/?reset +vips *$/i))) {
                    self.reset();
                    bot.pm('Alright, the VIP list has been cleared :)', sender);
                }
                else if ((reData = data.text.match(/^ *\/?vips *$/i))) {
                    var msg = '';

                    for (var id in __vipList) {
                        msg += __vipList[id];
                        msg += ', ';
                    }
                    if (msg) {
                        msg = msg.substring(0, msg.length - 2);
                    }
                    else {
                        msg = 'There are currently no VIPs :(';
                    }
                    bot.pm(msg, sender);
                }
            }
        });

        // If we're in VIP mode, we have to block all incoming messages
        bot.on('speak', function(data) {
            var reData = null;
            if (!__vipMode) {
                self.emit('speak', data);
            }
            else if ((reData = data.text.match(/^ *\/?q[?+-] *$/i)) || (reData = data.text.match(/^ *\/?q[+-][0-9]+ +\S.*? *$/i))) {
                bot.speak('Sorry, the queue is disabled in VIP mode.');
            }

            if ((reData = data.text.match(/^ *\/?vips *$/i))) {
                var msg = '';

                for (var id in __vipList) {
                    msg += __vipList[id];
                    msg += ', ';
                }
                if (msg) {
                    msg = msg.substring(0, msg.length - 2);
                }
                else {
                    msg = 'There are currently no VIPs :(';
                }
                bot.speak(msg);
            }
        });
    };

    this.setVipMode = function() {
        var utils = self.getDep('utils');
        __vipMode = true;
        utils.reset();
    };
    this.unsetVipMode = function() {
        __vipMode = false;
        for (var id in __kickList) {
            clearKickTimer(id);
        }
        __kickList = {};
    };

    this.addVip = function(id, name) {
        if (!name) {
            var utils = self.getDep('utils');
            name = utils.getUserById(id).name;
        }
        __vipList[id] = name;
        return true;
    };
    this.removeVip = function(id) {
        if (!__vipList[id]) {
            return false;
        }
        delete __vipList[id];
        return true;
    };

    this.isVip = function(id) {
        if (__vipList[id]) {
            return true;
        }
        return false;
    };

    this.reset = function() {
        self.unsetVipMode();
        __vipList = {};
    };
};

module.exports = Vips;
