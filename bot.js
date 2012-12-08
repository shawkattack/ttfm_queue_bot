// This software is Copr. David Scherzinger, 2011-2012.
// Any portion of this code authored by other individuals has been marked.
//
// I give full rights to use and distribute any source, concepts, or features
// included in this document, provided that:
// 1. You provide proper credit to me by either my full name or github username
//    (shawkattack) for any content used. You provide proper credit to other
//    authors as their information is presented in any authorship comments.
// 2. Unless your name is provided in authorship comments on the master copy of
//    this document, you MAY NOT assume or claim ownership of any aspect of
//    this software. If you copied anything from this document, you did not
//    write it.
// 3. Any product or template that uses any content from this document must not
//    be intrinsically and/or intentionally designed for causing any type of
//    detriment to people, society, or this planet's ecosystem.
// 4. YOU ASSUME ALL LIABILITY FOR ANY NEGATIVE CONSEQUENCES THAT ARISE AS A
//    RESULT OF YOUR USE OF ANY CONTENT IN THIS DOCUMENT. In other words, if
//    you, for whatever reason, absolutely must borrow my code for your
//    purposes, and you don't integrate it into your product properly, and
//    people die or become badly injured, or you crash a server as a result of
//    your sloppy practices, IT IS YOUR FAULT for not adapting the code and
//    correcting any errors that may arise.

// FEATURE Enqueueing activated
// FEATURE Dequeueing activated
// FEATURE Spot checking activated
// FEATURE Queue printing activated
// FEATURE Away coverage activated
// FEATURE Auto queue clearing activated
// FEATURE Command list activated
// FEATURE Help files activated
// FEATURE OOG flagging activated
// FEATURE Queue rearrangement activated
// FEATURE Skip message activated
// FEATURE Self-labeled afk

// TODO IMPORTANT list brb and afk djs
// TODO WE GET LIFTED!!!!
// TODO re-call next in queue if they enter the room
//      AND stay for 10 seconds
// TODO nicknames
// TODO jokes
// TODO make me a sandwich

var config = require('./config.js'); // Config is private, stored locally
var Bot = require('ttapi');
var bot = new Bot(config.auth, config.user_id, config.room_id);

bot.tcpListen(8080,'127.0.0.1');  // Start a new tcp channel listener on home

const my_script_version = 'v5.0'; // Probably useless, but w/e
const self_id = config.user_id;
const oog_kick_message = config.oog_kick_message || 'Sorry, please try to stay in genre!';
//const upvote_thresh = 0.3;        // Percentage of users required to upvote for a bot upvote
const upvote_thresh = 0.25;       // Percentage of users required to upvote for a bot upvote
const up = -1, down = 1;          // Constants for queue rearrangement
const skip_message = 'This sounds out of genre. Please skip';

const brb_dj_time = 45*1000;      // Constant for DJ away coverage
const brb_q_time = 10*60*1000;    // Constant for queue away coverage
const q_call_time = 40*1000;      // Constant for waiting for queue callee to respond
const q_rem_time = 120*1000;       // Constant for waiting to remove user from queue
const song_leeway = 7*1000;       // Constant for waiting after song ends to issue warning
const skip_leeway = 7*1000;       // Constant for waiting after warning to skip
const dj_type = 'djs';            // Constant for accessing dj aways
const q_type = 'qs';              // Constant for accessing q aways

var g_users = {};        // Index: lowercase username; Data: {name = username, id = hex ID}
var g_num_users = 0;     // Number of users in room
var g_mods = [];         // List of hex IDs of mods
var g_djs = [];          // List of hex IDs of DJs
var g_max_djs = 0;       // Number of max DJs
var g_num_djs = 0;       // Number of DJs on decks
var g_num_away_djs = 0;  // Number of DJ aways
//var g_num_away_qs = 0;   // Number of Q aways
var g_num_spots = 0;     // Number of available spots (includes DJs with away coverage)
var g_num_active_q = 0;  // Number of non-away queue-ees
var g_current_dj = '';   // Hex ID of current DJ
var g_current_song = ''; // Hex ID of current song
var g_to_kick = '';      // The user that the bot will remove when the song changes
var g_kick_mark = '';    // A user that the bot has removed because of a full queue
var g_kicks = {};        // List of kick me notes
var g_song_timer = null; // Song timeout timer
var g_stuck_timer = null;// Kick timeout timer
var g_song_limit = 0;    // Song limit - falsey value means no limit

var g_has_voted = 0;     // Whether the bot has voted

var g_queue = [];        // THE QUEUE
var g_on_call = null;    // The user who is being called for the queue
var g_call_timer = null; // The calling timer
var g_oog_flags = {};    // Quick-access check if a user has flagged a song
var g_num_flags = 0;     // Number of users who have flagged
var g_brbs = {};         // Collection of brb timers
g_brbs[dj_type] = {};
g_brbs[q_type] = {};
var g_just_left = {};    // Collection of queue deletion timers

var g_mark = '';         // Optional punctuation for spam foiling
var g_skip_displayed;    // Flag set when skip message has been displayed

const help_text = {    // List of command help descriptions
    'q+':'Type q+ to add yourself to the queue',
    'q-':'Type q- to remove yourself from the queue',
    'q?':'Type q? to print the queue',
    'myspot':'Type myspot to view your spot on the queue',
    'away':('If you\'re on decks and need to refresh, type away, and I\'ll guard your seat for 45 seconds. '+
	    'If you\'re on the queue and need to step away, type away, and I\'ll save your spot for 10 minutes'),
    'back':'If I\'m holding your spot on the queue, type back to let me know you\'re back',
    'oog':'Type oog to report out-of-genre music. If enough people join you, I\'ll remove the problem',
    'help':'Type help followed by another command to see how to use it. Type commands to see a list of commands',
    'commands':'Type commands to see a list of commands',
    'kickme':('Type kickme on q and I\'ll escort you when the queue fills up. '+
	      'Type kickme after x and I\'ll escort you after you play x songs (x must be a number)'),
    'cancel':'Type cancel kickme to cancel your kickme request',
};

bot.on('tcpConnect', function (socket) { });   // Do nothing
bot.on('tcpEnd', function (socket) { });       // Do nothing
bot.on('tcpMessage', function (socket, msg) {  // DEBUGGING
    var speakMatch = msg.match(/^speak (.*)$/);
    var userMatch = msg.match(/^user (\S.*)$/);
    
    if (msg == 'version') {
	socket.write('>> '+myScriptVersion+'\n');
    }
    // Print the queue out
    else if (msg == 'queue') {
	for(var i = 0; i < g_queue.length; i++) {
	    socket.write('>> '+g_queue[i].name+'\n');
	}
    }
    // Print a list of users, * means they're a mod
    else if (msg == 'users') {
	for(var i in g_users) {
	    socket.write('>> '+g_users[i].name+
			 (is_mod(g_users[i].id) ? '*' : '')+
			 '\n');
	}
    }
    // Forces the bot to downvote
    else if (msg == 'boo') {
	bot.vote('down');
    }
    // Print a list of dj IDs (not usernames)
    else if (msg == 'djs') {
	var ui;
	for(var dj in g_djs) {
	    ui = get_user_info(dj);
	    socket.write('>> '+ui.name+'\n');
	}
    }
    // Print information on brb users
    else if (msg == 'brbs') {
	socket.write('>> DJ brbs:\n');
	for(i in g_brbs[dj_type]) {
	    socket.write('>>     '+i+'\n');
	}
	socket.write('>> Queue brbs:\n');
	for(i in g_brbs[q_type]) {
	    socket.write('>>     '+i+'\n');
	}
    }
    // Print important deck info
    else if (msg == 'decks') {
	socket.write('>> num_djs: '+g_num_djs+'\n');
	socket.write('>> num_away_djs: '+g_num_away_djs+'\n');
    }
    // Snag the current song
    else if (msg == 'snag') {
	snag_song();
    }
    // Make the bot say something
    else if (speakMatch) {
	bot.speak(speakMatch[1]);
    }
    // Get a user's hex ID and correctly capitalized username
    else if (userMatch) {
	var ui = get_user_info(userMatch[1]);
	if(ui) {
	    socket.write('>> id:   '+ui.id+'\n');
	    socket.write('>> name: '+ui.name+'\n');
	}
	else {
	    socket.write('>> User not found\n');
	}
    }
});

bot.on('roomChanged', function (data) { // Initialize the bot
    console.log('RESTARTED - Joining room "'+data.room.name+'"');

    // Build user list
    g_users = {};
    user_list = data.users;
    g_num_users = user_list.length
    for (var i = 0; i < g_num_users; i++) {
	var uname = user_list[i].name;
	g_users[uname.toLowerCase()] =
	    {name: uname,
	     id:   user_list[i].userid};
    }

    // Rebuild queue if re-connecting
    var q_tmp = [];
    for (var i in g_queue) {
	var info = get_user_info(g_queue[i].name);
	if (info) {
	    q_tmp.push(
		{name: info.name,
		 id:   info.id});
	}
    }
    g_queue = q_tmp;
    
    // Get mod list
    g_mods = data.room.metadata.moderator_id;
    // Get dj info
    g_djs = data.room.metadata.djs;
    g_max_djs = data.room.metadata.max_djs;
    g_current_dj = data.room.metadata.current_dj;
    var song_info = data.room.metadata.current_song;
    if (song_info) {
	g_current_song = song_info._id;
    }
    g_num_djs = g_djs.length;
    g_num_spots = g_max_djs - g_num_djs;

    // Vote if necessary
    upvotes = data.room.metadata.upvotes;
    if (upvotes >= min_votes()) {
	bot.vote('up');
    }

    // Build command list
    command_list = '';
    for (i in help_text) {
	command_list += i;
	command_list += ', ';
    }
    command_list = command_list.substring(0,command_list.length-2);
    if (g_djs.length < 2) {
	bot.addDj();
    }
});

bot.on('update_user', function (data) { // When a user changes their name
    // If there's name data and no user info for the name...
    if (data.name && !get_user_info(data.name)) {
	var udata = get_user_info_r(data.userid); // Get the old info
	var q_pos;
	g_users[data.name.toLowerCase()] =        // Add new info
	    {name: data.name,
	     id:   data.userid};
	delete g_users[udata.name.toLowerCase()]; // Delete old info
	if (q_pos = is_queued(data.userid)) {
	    g_queue[--q_pos].name = data.name;    // Update queue
	}
	if (g_on_call && g_on_call.id == data.userid) {
	    g_on_call.name = data.name;           // Update on_call
	}
	console.log(udata.name+' is now '+data.name);
    }
});

bot.on('registered', function (data) { // When a user joins the room
    // Add user to user list
    var name = data.user[0].name;
    var id = data.user[0].userid;
    g_users[name.toLowerCase()] =
	{name: name,
	 id:   id};
    g_num_users++;
    
    // If the user has left recently
    if (g_just_left[id]) {
	var q_pos = is_queued(id)-1;
	g_queue[q_pos].name = name;
	clearTimeout(g_just_left[id]); // Clear and remove their timer
	delete g_just_left[id];
	console.log('Removing delete timer for '+name);
    }

    // Update mod list
    if (!is_mod(id)) { // If the user isn't a recognized mod
	bot.roomInfo(function (data) { // Re-load the list
	    g_mods = data.room.metadata.moderator_id;
	});
    }
});

bot.on('deregistered', function (data) { // When a user leaves the room
    // Remove user from user list
    var name = data.user[0].name;
    var id = data.user[0].userid;
    delete g_users[name.toLowerCase()];
    g_num_users--;
    
    // If user who left isn't away and is on queue, set a timer to remove from queue
    if (!is_away(id,q_type) && is_queued(id)) {
	console.log('Adding delete timer for '+name);
	g_just_left[id] = setTimeout(function () {
	    rem_from_queue(id);
	    delete g_just_left[id];
	},q_rem_time);
    }
});

bot.on('newsong', function (data) { // When a new song starts
    // RESET EVERYTHING
    g_current_dj = data.room.metadata.current_dj;
    g_current_song = data.room.metadata.current_song._id;
    g_has_voted = 0;
    g_skip_displayed = false;
    g_oog_flags = {};
    g_num_flags = 0;
    if (g_song_timer) {
	clearTimeout(g_song_timer);
	g_song_timer = null;
    }
    if (g_stuck_timer) {
	clearTimeout(g_stuck_timer);
	g_stuck_timer = null;
	msg('Thank you! ',':)');
    }
    var song_length = data.room.metadata.current_song.metadata.length*1000;

    if (g_to_kick) { // If someone needs to drop, remove and reset
	var name = get_user_info_r(g_to_kick);
	name = name.name;
	console.log('New song! Kicking '+name);
	bot.remDj(g_to_kick);
	g_to_kick = '';
    }
    check_kick_mes(g_current_dj);
    g_song_timer = setTimeout(function () {
 	g_song_timer = null;
	if (g_current_dj == self_id) {
	    msg('I think I might be stuck ',':(');
	}
	else {
	    var name = get_user_info_r(g_current_dj);
	    name = tag_name(name.name);
	    msg('Hey, '+name+', you\'re stuck! Please skip','!');
	}
	g_stuck_timer = setTimeout(function () {
	    g_stuck_timer = null;
	    if (g_current_dj == self_id) {
		msg('Sorry about that! ',':P');
		bot.stopSong();
	    }
	    else {
		bot.remDj(g_current_dj);
	    }
	},skip_leeway);
    },song_length+song_leeway);
});

bot.on('update_votes', function (data) { // When someone votes
    // Vote if necessary
    upvotes = data.room.metadata.upvotes;
    downvotes = data.room.metadata.downvotes;
    if (upvotes >= min_votes()) {
        bot.vote('up');
	g_has_voted = 1;
    }

    // Vote down if people reverse their votes
    else if (g_has_voted && downvotes >= upvotes) {
        bot.vote('down');
    }
});

bot.on('add_dj', function (data) { // When a dj hops up
    var id = data.user[0].userid;
    var name = data.user[0].name;
    g_djs.push(id);                // Add DJ to list
    g_num_djs = g_djs.length;      // Get number of DJs, number of spots
    g_num_spots = g_max_djs - g_num_djs - g_num_away_djs;
    if (g_song_limit) {            // Add kickme after song limit
	if (g_queue.length <= 0) { // Remove song limit
	    set_limit(null,'0');
	}
	else {                     // Or impose it
	    g_kicks[id].songs = g_song_limit;
	}
    }
    var spot = real_queue_pos(id); // Check the queue position of the new DJ
    if (is_away(id,dj_type)) {     // If they have DJ away coverage, remove it
	rem_brb(id,name);
    }
    else {                         // Otherwise...
	spot = spot-1;
	if (spot > g_num_spots) {  // If there isn't enough room on the decks, kick
	    bot.remDj(id);
	    if (spot < g_queue.length) {
		msg('Hey! No cutting in line!',' >:C');
	    }
	    else {
		msg('Sorry, I\'m saving that spot for someone! '+
		    'If you want to dj, type q+ into chat','.');
	    }
	    console.log(name+' (spot #'+(spot+1)+') tried to DJ with '+
			(g_num_spots+1)+' spots available');
	}
	else {                   // If there is enough room, remove from queue and cancel away coverage
	    rem_brb(id,name);

	    if (g_on_call){console.log(g_on_call.name+' is on call');}

	    rem_from_queue(id);
	    console.log(name+' (spot #'+(spot+1)+') is now DJing');
	}
    }
    if (g_num_spots > 0 && g_queue.length > 0) {
	call_next();             // If there are still spots left, call the next person
	console.log('Spots still available!');
    }
    if (g_max_djs-g_num_spots > 2) { // If there are too many DJs, drop
	if (g_current_dj == self_id) {
	    g_to_kick = self_id;   // Wait until end of my song though ;)
	}
	else {
	    bot.remDj(self_id);
	}
    }
});

bot.on('rem_dj', function (data) {
    var id = data.user[0].userid;
    var name = data.user[0].name;
    var idx = is_dj(id);
    g_djs.splice(idx-1,1);    // Remove DJ from list
    g_num_djs = g_djs.length; // Update number of DJs, spots
    g_num_spots = g_max_djs - g_num_djs - g_num_away_djs;
    rem_kick_me(id,name);     // Remove any kick-me notes
    if (id == g_kick_mark) {  // If it was an 'on q' boot, reset
	g_kick_mark = '';
    }
    else if (g_num_spots > 0) {      // If there are spots, call next on queue
	call_next();
    }
    if (g_max_djs-g_num_spots < 2) { // DJ if necessary
	bot.addDj();
    }
    console.log(name+' stopped DJing');
});

bot.on('new_moderator', function (data) { // When someone tries to mod a user
    if (!is_mod(data.userid)) { // If they're not approved, demod them immediately
	bot.remModerator(data.userid);
    }
});

bot.on('rem_moderator', function (data) { // When someone tries to demod a user
    if (is_mod(data.userid)) { // If they're approved, remod them immediately
	bot.addModerator(data.userid);
    }
});

bot.on('pmmed', function (data) { // When someone pms the bot
    var mod_match =
	data.text.match(/^\s*(de|un)?mod\s+(\S.*?)\s*$/i); // mod/demod
    var snag_match =
	data.text.match(/^\s*snag\s*$/i);                  // snag song
    var limit_match =
	data.text.match(/^\s*(?:set\s+)?limit\s+([0-9]+|off)\s*$/i); // song limit
    if (mod_match) {
	change_mod(data.senderid, get_user_info(mod_match[2]), mod_match[1]);
    }
    else if (snag_match) {
	snag_song(data.senderid);
    }
    else if (limit_match) {
	set_limit(data.senderid, limit_match[1]);
    }
});

bot.on('speak', function (data) { // Handle chat commands
    //User commands
    //  q+, q-, q?, myspot, away, back, oog, help, commands
    //Mod commands
    //  q+[#] [un], q-[#] [un], .s

    // Regexes to recognize commands.
    var enqueue_match =
	data.text.match(/^\s*\/?q\+\s*$/i);
    var dequeue_match =
	data.text.match(/^\s*\/?q-\s*$/i);
    var upqueue_match =
	data.text.match(/^\s*\/?q\+([0-9]+)\s+(\S.*?)\s*$/i);
    var dnqueue_match =
	data.text.match(/^\s*\/?q-([0-9]+)\s+(\S.*?)\s*$/i);
    var sequeue_match =
	data.text.match(/^\s*\/?q\?\s*$/i);
    var my_spot_match =
	data.text.match(/^\s*\/?my\s*spot\s*$/i);
    var oogenre_match =
	data.text.match(/^\s*\/?oog\s*$/i);
    var skipmsg_match =
	data.text.match(/^\s*\.s\s*$/i);
    var command_match =
	data.text.match(/^\s*\/?commands\s*$/i);
    var helpplz_match =
	data.text.match(/^\s*\/?help(?:\s+(.*?))?\s*$/i);
    var brbaway_match =
	data.text.match(/^\s*\/?away\s*$/i);
    var brbback_match =
	data.text.match(/^\s*\/?back\s*$/i);
    var kickplz_match =
	data.text.match(/^\s*\/?(?:boot|kick|remove)\s*me(\s+\S.+?)?\s*$/i);
    var remkick_match =
	data.text.match(/^\s*\/?(?:cancel\s+(?:boot|kick|remove)\s*me|(?:boot|kick|remove)\s*me\s+cancel)\s*$/i);
    var bopplz_match =
	data.text.match(/^\s*\/?(?:bop|dance|party)\s*$/);
    
    if (enqueue_match) {
	enqueue(data.userid, data.name);
    }
    else if (dequeue_match) {
	dequeue(data.userid, data.name);
    }
    else if (upqueue_match) {
	move_in_queue(data.userid, get_user_info(upqueue_match[2]),
		      parseInt(upqueue_match[1],10), up);
    }
    else if (dnqueue_match) {
	move_in_queue(data.userid, get_user_info(dnqueue_match[2]),
		      parseInt(dnqueue_match[1],10), down);
    }
    else if (sequeue_match) {
	print_queue();
    }
    else if (my_spot_match) {
	print_spot(data.userid, data.name);
    }
    else if (oogenre_match) {
	oog_flag(data.userid);
    }
    else if (skipmsg_match) {
	print_skip_message(data.userid);
    }
    else if (command_match) {
	print_commands();
    }
    else if (helpplz_match) {
	print_help(helpplz_match[1]);
    }
    else if (brbaway_match) {
	add_brb(data.userid, data.name);
    }
    else if (brbback_match) {
	rem_brb(data.userid, data.name);
	if (is_queued(data.userid)) {
	    preempt_call(data.userid, data.name);
	}
    }
    else if (remkick_match) {
	rem_kick_me(data.userid, data.name, true);
    }
    else if (kickplz_match) {
	add_kick_me(data.userid, data.name, kickplz_match[1]);
    }
    else if (bopplz_match) { // Easter egg/surprise for brostep twits
	msg('BITCH THIS AIN\'T THE DUBSTEP ROOM','!');
    }

});

/*
 * msg: Calls bot.speak with spam foiling
 * text: Message text
 * punc: String to include/not include for spam foiling
 * return: none
 */
function msg(text, punc) {
    g_mark = (g_mark ? '' : punc); // Flip punctuation mark
    bot.speak(text+g_mark);      // And SPEAK
}

/*
 * tag_name: Turns a user name into a chat tag
 * name: Properly capitalized username
 * return: Properly capitalized chat tag
 */
function tag_name(name) {
    if (name.charAt(0) == '@') {
	return name;
    }
    else {
	return '@' + name;
    }
}

/*
 * get_user_info: Gets username and hex ID
 * username: Case-insensitive username to search for
 * return: Object { name, id }
 *     name: Properly capitalized username
 *     id:   Hex ID of user
 */
function get_user_info(username) {
    var name = username.toLowerCase();  // Get lowercase name
    var ret = g_users[name];              // Try to get info
    if(!ret && name.charAt(0) == '@') { // If it doesn't exist, but name was tagged
	ret = g_users[name.substring(1)]; // Try without tag
    }
    return ret;
}

/*
 * get_user_info_r: Gets username and hex ID from hex ID
 *     NOTE - This is much slower than get_user_info. Avoid unless necessary
 * id: Hex ID of user to search for
 * return: Object { name, id }
 *     name: Properly capitalized username
 *     id:   Hex ID of user
 */
function get_user_info_r(id) {
    for (var i in g_users) {
	if (g_users[i].id == id) {
	    return g_users[i];
	}
    }
    return undefined;
}

/*
 * obj_size: Determines the size of an associative array/object
 * obj: Input object
 * return: number of fields in object
 */
function obj_size(obj) {
    var count = 0; // Simple count
    for (i in obj) {
	count++;
    }
    return count;
}

/*
 * is_mod: Determines if a user is a moderator
 * id: Hex ID of user
 * return: 0 if user is not a mod
 *         Non-zero if user is a mod
 */
function is_mod(id) {
    for (var i = 0; i < g_mods.length; i++) { // Check every mod
	if (g_mods[i] == id) {
	    return i+1;
	}
    }
    return 0;
}

/*
 * is_queued: Determines if a user is on the queue
 * id: Hex ID of user
 * return: 0 if user is not on queue
 *         Non-zero if user is on queue
 */
function is_queued(id) {
    for (var i = 0; i < g_queue.length; i++) { // Check each queue spot
	if (g_queue[i].id == id) {
	    return i+1;
	}
    }
    return 0;
}

/*
 * is_dj: Determines if a user is on the deck
 * id: Hex ID of user
 * return: 0 if user is not DJing
 *         Non-zero if user is DJing
 */
function is_dj(id) {
    for (var i = 0; i < g_djs.length; i++) { // Check each dj spot
	if (g_djs[i] == id) {
	    return i+1;
	}
    }
    return 0;
}

/*
 * is_away: Determines if a user has away coverage
 * id: Hex ID of user
 * return: null if user has no coverage
 *         Non-null if user has coverage
 */
function is_away(id,type) {
    return g_brbs[type][id];
}

/*
 * real_queue_pos: Determines when a user will be called
 * id: Hex ID of user
 * return: 0 if user is not on queue
 *         Position in queue, factoring in away coverage
 */
function real_queue_pos(id) {
    idx = 1;
    for (var i = 0; i < g_queue.length; i++) { // Go through the queue
	if (g_queue[i].id == id) {             // If this is our user, return the count
	    break;
	}
	if (!is_away(g_queue[i].id,q_type)) {  // Only increment for non-away users
	    idx++;
	}
    }
    return idx;
}

/*
 * min_votes: Calculates minimum number of upvotes required for bot to upvote
 * return: Minimum number of votes
 */
function min_votes() {
    // All numbers subject to change
    /*
    if (num_users <= 4) {
	return 1;
    }
    if (num_users <= 7) {
	return 2;
    }
    if (num_users <= 10) {
	return 3;
    }
    */
    return upvote_thresh*(g_num_users-1)+g_has_voted;
}

/*
 * change_mod: Changes mod status
 * sender: Hex ID of requestor
 * target: UI object of target
 * add:    true if adding
 *         false if removing
 * return: none
 */
function change_mod(sender, target, add) {
    var idx = 0;
    if (!(idx = is_mod(sender))) {   // If the requestor isn't a mod, err
	bot.pm('Sorry, only mods are allowed to change mod status :(',sender);
	return;
    }
    if (!target) {                   // If the target is null
	bot.pm('I\'m sorry, I can\'t find that user in the room.',sender);
	return;
    }
    if (target.id == self_id && add) { // If the target is me
	bot.pm('Nice try, but I\'m INVINCIBLE! Muahahahaha >:D',sender);
	return;
    }
    idx = is_mod(target.id);         // Check if target is a mod
    if (add) {                       // If the command is a de-mod
	if(!idx) {                   // If the target is not a mod
	    bot.pm(target.name+' is already not a mod!',sender);
	    return;
	}
	g_mods.splice(idx-1,1);        // Remove target from list
	bot.remModerator(target.id); // De-mod target
	bot.pm('You\'re the bawss!',sender);
    }
    else {                           // If the command is a mod
	if(idx) {                    // If the target is a mod
	    bot.pm(target.name+' is already a mod!',sender);
	    return;
	}
	g_mods.push(target.id);        // Add target to list
	bot.addModerator(target.id); // Mod target
	bot.pm('OK, done :)',sender);
    }
}

/*
 * call_next: Calls next person on queue with no away coverage
 * return: none
 */
function call_next() {
    if (g_on_call) {                                // If someone's already on call, do nothing
	console.log('Someone is already on call!');
	return;
    }
    for (var i = 0; i < g_queue.length; i++) {
	g_on_call = g_queue[i];	                  // Find the next non-away user
	if (!is_away(g_on_call.id,q_type)) {        // Get user info
	    var name = tag_name(g_on_call.name);
	    var id = g_on_call.id;
	    msg(name+', you\'re up!','');         // Call the user by using @ tagging
	    g_call_timer = setTimeout(function () { // Set up timeout script - message and remove from queue
		msg('Sorry, '+name+', you took too long!','');
		rem_from_queue(id);
		g_call_timer = null;
	    }, q_call_time);
	    console.log('Calling '+name+' in spot '+(i+1));
	    return;
	}
    }
    console.log('Nobody to call!');
    g_on_call = null;                               // If we've made it this far, the spot is free
}

/*
 * preempt_call: Pre-empts the queue call for a user if allowable
 * id: Hex ID of user
 * name: Properly capitalized username
 * pos: is_queued(id) (optional)
 * return: none
 */
function preempt_call(id, name, pos) {
    if (!pos && pos !== 0) {         // Get queue position if not provided
	pos = is_queued(id);
    }
    if (!g_on_call || pos === 0) {     // If nobody is on call or user not in queue
	return;                      // Then there's nothing to do
    }
    var idx = is_queued(g_on_call.id); // Get queue position of current callee
    if (pos < idx) {                 // If user is higher up queue than callee
	console.log(name+' is preempting '+g_on_call.name);
	g_on_call = null;              // Reset calling variables
	clearTimeout(g_call_timer);
	g_call_timer = null;
	call_next();                 // Call next
    }
}

/*
 * enqueue: Adds a user to the queue if they are queue-able
 * id: Hex ID of user
 * name: Properly capitalized username
 * return: none
 */
function enqueue(id, name) {
    var did_kick_me = false;
    if (is_queued(id)) {       // Already in the queue, err
	msg('You\'re already on the queue, '+name,'.');
	return;
    }
    if (is_dj(id)) {           // Already DJing, err
	msg('You\'re already on the decks, '+name,'.');
	return;
    }
    if (is_away(id,dj_type)) { // Has DJ away coverage, err
	msg('I\'m guarding your spot! Stop trying to queue, and hop back up already','!');
	return;
    }
    g_queue.push(                // If everything checks out, add to queue
	{name: name,
	 id:   id});
    g_num_active_q = g_queue.length - obj_size(g_brbs[q_type]); // Update
    if (g_num_active_q > g_num_spots) {  // If there are more on q than spots open
	did_kick_me = check_kick_mes('q'); // Check for an 'on q' kick me
    }
    if (did_kick_me || real_queue_pos(id) <= g_num_spots) {
                         // If there are spots available, why not just hop up?
	msg('Hop on up, '+name+' :)','');
	g_on_call = {id: id, name: name};
    }
    else if (g_on_call && !g_call_timer) {
	                 // If not enough spots and someone's asleep, start the timer
	g_on_call = null;
	call_next();
	console.log('Woke up '+g_on_call.name);
    }
    else {               // Otherwise, they've been put on the waitlist
	msg('I\'ve added you to the queue, '+name+' :)','');
    }
    console.log('Queued up '+name);
}

/*
 * dequeue: Removes a user from the queue if they are on it, clears away coverage
 * id: Hex ID of user
 * name: Properly capitalized username
 * return: none
 */
function dequeue(id, name) {
    if (!is_queued(id)) { // If the user isn't on the queue, complain
	msg('You aren\'t on the queue, '+name,'.');
	return;
    }
    rem_brb(id, name);    // Remove away coverage
    rem_from_queue(id);   // Remove from queue
    msg('I\'ve removed you from the queue, '+name+' :)','');
    console.log('Removed '+name+' from the queue');
}

/*
 * move_in_queue: Moves a target user up or down in the queue by amount specified
 * id: Hex ID of requestor
 * target: UI object of target
 * amount: Number of spaces to move
 * dir: Direction to move - use predefined constants up and down
 * return: none
 */
function move_in_queue(id, target, amount, dir) {
    if (!is_mod(id)) {                           // If requestor isn't a mod, err
	msg('Sorry, only mods are allowed to move people in the queue :(','');
	return;
    }
    if (!target) {                               // If the target doesn't exist, err
	msg('I\'m sorry, I can\'t find that user in the room','.');
	return;
    }
    if (is_dj(target.id)) {
	msg(target.name+' is already on the decks','.');
	return;
    }
    if (target.id == self_id) {
	msg('Nice try! I go up when I want! >:D','');
    }
    var spot, oldspot, newspot;
    if (!(spot = is_queued(target.id))) {      // If the user isn't queued, start at end of queue
	oldspot = g_queue.length;
    }
    else {
	oldspot = spot-1;
    }
    newspot = spot+amount*dir-1;               // Calculate new position
    if (newspot < 0) {
	newspot = 0;
    }
    else if (newspot > g_queue.length) {
	newspot = g_queue.length;
    }
    if (spot && newspot == oldspot) {          // If there's a zero move, complain
	msg('Y U MOVE 0','?');
	return;
    }
    if (spot) {                                // Remove user from queue if they're on it
	rem_from_queue(target.id);
    }
    g_queue.splice(newspot,0,{name: target.name, // Add user back in
			      id: target.id});
    if (id != target.id) {
	msg('OK, '+target.name+' has been moved to spot '+(newspot+1),'.');
    }
    else {
	msg('OK, '+target.name+', you\'ve been moved to spot '+(newspot+1),'.');
    }
    g_num_active_q = g_queue.length - obj_size(g_brbs[q_type]);
    console.log(target.name+' has been moved from spot '+(oldspot+1)+' to spot '+(newspot+1));
}

/*
 * print_queue: Prints the queue to chat
 * return: none
 */
function print_queue() {
    if (g_queue.length == 0) { // Empty queue message
	msg('The queue is empty right now','.');
	return;
    }
    text = '';               // Otherwise, build the list and print
    for (var i = 0; i < g_queue.length; i++) {
	var name = is_away(g_queue[i].id, q_type) ?
	    '('+g_queue[i].name+')' :
	    g_queue[i].name;
	text += ((i+1)+' - '+name);
	if (i < g_queue.length-1) {
	    text += ', ';
	}
    }
    msg(text,'.');
}

/*
 * print_spot: Prints a user's position in the queue, factoring in away coverage
 * id: Hex ID of user
 * name: Properly capitalized username
 * return: none
 */
function print_spot(id, name) {
    spot = real_queue_pos(id); // Get effective position in queue
    text = '';
    if (!is_queued(id)) {      // If the user isn't on the queue
	if (!is_away(id,dj_type)) {
	    text = 'You\'re not on the queue, ';
	}
	else {	               // Away coverage signifies a DJ
	    text = 'I\'m guarding your DJ spot. Hurry and get back up, ';
	}
    }
    else {                     // Otherwise, print position
	if (spot == 1) {
	    text = 'You\'re next on the queue, ';
	}
	else if (spot == 2) {
	    text = 'There\'s 1 person in front of you, ';
	}
	else {
	    text = 'There are '+(spot-1)+' people in front of you, ';
	}
	rem_brb(id, name);
    }
    msg(text+name,'!');
}

/*
 * oog_flag: Records an out-of-genre flag and acts accordingly
 * id: Hex ID of user
 * return: none
 */
function oog_flag(id) {
    if (g_oog_flags[id]) {       // If the user has already flagged, do nothing
	return;
    }
    g_oog_flags[id] = true;      // Otherwise, set the flag and increment
    g_num_flags++;
    if (g_num_flags == 2) {      // 2 flags - warn and downvote
	bot.vote('down');
	if (!g_skip_displayed) {
	    msg(skip_message,'.');
	    g_skip_displayed = true;
	}
    }
    else if (g_num_flags == 3) { // 3 flags - DAS BOOT
	bot.remDj(g_current_dj);
	msg(oog_kick_message,'.');
    }
    console.log('OOG VOTE!!!!!111!ONEONEONEONE');
}

/*
 * print_skip_message: Prints a skip warning directly and adds caller to flag list
 * id: Hex ID of user
 * return: none
 */
function print_skip_message(id) {
    if (is_mod(id)) {          // If the user isn't a mod, do nothing
	if (!g_skip_displayed) { // Otherwise, if the warning hasn't been given, then give it
	    msg(skip_message,'.');
	    g_skip_displayed = true;
	}
	oog_flag(id); 	       // Count as an oog vote
    }
}

/*
 * print_commands: Prints a list of bot commands
 * return: none
 */
function print_commands() {
    msg(command_list,'');
}

/*
 * print_help: Prints a help file for a command - default command is 'help'
 * cmd: The command in question
 * return: none
 */
function print_help(cmd) {
    var text;
    if (!cmd || !(text = help_text[cmd])) { // If the command isn't specified in the help files, print default
	msg(help_text['help'],'.');
    }
    else {                                  // Otherwise, print the proper help file
	msg(text,'.');
    }
}

/*
 * add_brb: Adds away coverage for a DJ or queued user
 * id: Hex ID of user
 * name: Properly capitalized username
 * return: none
 */
function add_brb(id, name) {
    rem_brb(id, name);               // Remove any away coverage
    var time;
    var type;
    if (is_dj(id)) {                 // Determine proper time to wait
	time = brb_dj_time;
	type = 'djs';
    }
    else if (is_queued(id)) {
	time = brb_q_time;
	type = 'qs';
    }
    else {                           // Quit if they don't need coverage
	return;
    }
    g_brbs[type][id] =
	setTimeout(function () {     // When time runs out, remove coverage and warn
		rem_brb(id,name);
	    msg(name+', your brb period is over','!');
	    if (!get_user_info(name) && is_queued(id)) {
		g_just_left[id] = setTimeout(function () {
		    rem_from_queue(id);
		},q_rem_time);
	    }
	}, time);
    g_num_away_djs = obj_size(g_brbs[dj_type]);
    g_num_spots = g_max_djs - g_num_djs - g_num_away_djs;
    g_num_active_q = g_queue.length - obj_size(g_brbs[q_type]);
    msg('OK, got you covered, '+name,'.'); // Let user know they're covered
    console.log('Adding brb coverage for '+name);
    if(g_on_call && id == g_on_call.id) {      // Call next if user was on call
	clearTimeout(g_call_timer);
	g_call_timer = null;
	g_on_call = null;
	call_next();
    }
}

/*
 * rem_brb: Removes any away coverage for a user
 * id: Hex ID of user
 * name: Properly capitalized name of user
 * return: none
 */
function rem_brb(id, name) {
    var type;
    var brb = g_brbs[dj_type][id];       // Get the type of brb
    if(brb) {
	type = dj_type;
    }
    else if (brb = g_brbs[q_type][id]) {
	type = q_type;
    }
    else return;
    clearTimeout(brb); // Clear the timeout and the entry
    delete g_brbs[type][id];
    g_num_away_djs = obj_size(g_brbs[dj_type]); // UPDATE EVERYTHING
    g_num_spots = g_max_djs - g_num_djs - g_num_away_djs;
    g_num_active_q = g_queue.length - obj_size(g_brbs[q_type]);
    console.log('Clearing '+type+' brb coverage for '+name);
}

/*
 * add_kick_me: Adds a note to kick a user on certain events
 *      - on q: Remove user when queue fills up
 *      - after <#> (songs): Remove user after they have played # songs
 *      - Use 'or' to specify both
 * id: Hex ID of user
 * name: Properly capitalized name of user
 * return: none
 */
function add_kick_me(id, name, options) {
    // Mother of god........
    if (!is_dj(id)) { // If the user isn't a DJ, we can't kick them
	msg('I can\'t kick you if you\'re not on the decks :P','');
	return;
    }
    var did_q = false, did_songs = false;    // Init loop variables
    var message = 'Okay, I\'ll remove you '; // Init display

    // If no options were specified, then try to kick after current song
    if (!options || (options = options.split('or')).length == 0) {
	did_songs = 0;
    }
    // Otherwise, if there's a limit in place, apologize
    else if (g_song_limit) {
	msg('Sorry, there\'s a song limit in place. '+
	    'I\'m only taking blank kickmes for now ',':(');
	return;
    }

    // Otherwise, parse the options
    else for (var i in options) {
	var option = options[i]; // Get each option
	if (option) {            // If it has any contents, remove end spaces
	    option = option.trim();
	    var opt_q_match = option.match(/^on\s+q\s*$/i); // Match to either pattern
	    var opt_songs_match = option.match(/^(?:after|in)\s+([0-9]+)(?:\s+songs)?\s*$/i);
	}
	else {                   // If there are consecutive ors, be a nag
	    msg('Or... what? Try again, please!','');
	    return;
	}
	if (opt_q_match && !did_q) { // If we matched 'on q' and haven't before
	    did_q = true;            // Set an 'on q' kick-me
	}
	if (opt_songs_match && !did_songs) { // Same for 'after x songs'
	    did_songs = parseInt(opt_songs_match[1]);
	}
	if(did_q && did_songs) {     // If we've hit both, quit loop early
	    break;
	}
    }
    if (!did_q && did_songs === false) { // If we hit neither, ragequit
	msg('Sorry, something\'s not quite right there...', '');
	return;
    }
    g_kicks[id] = {};      // New object
    if (g_to_kick == id) { // If the user were to be kicked, clear this
	g_to_kick = '';
    }
    if (did_q) {         // For 'on q' note
	if (g_num_active_q > g_num_spots) { // Kick immediately if necessary
	    msg('WAZAM','!');
	    delete g_kicks[id];           // Remove the object and quit
	    bot.remDj(id);
	    return;
	}
	message += 'if the queue starts to fill up'; // Edit display
	g_kicks[id].q = true;    // If not kicking immediately, add note
	if (did_songs) {
	    message += ' or '; // Edit display if necessary
	}
    }
    if (did_songs !== false) {   // For 'after x songs' note
	if (did_songs == 0) {    // If we didn't get any options
	    if (id == g_current_dj) { // If user is current DJ kick after song
		message = 'OK, I\'ll kick you after your song is over';
		g_to_kick = id;    // Mark user for kick
	    }
	    else { // If user isn't current DJ, kick after NEXT song
		message += 'after you play your next song';
		g_kicks[id].songs = 1; // Kick after 1
	    }
	}
	else {
	    if (did_songs > 10) { // Limit number of songs
		did_songs = 10;
	    }
	    g_kicks[id].songs = did_songs;
	    if (did_songs == 1) { // Tailor message to the specified count
		message += 'after you play your next song';
	    }
	    else {
		message += 'after you play '+did_songs+' more songs';
	    }
	}
    }
    msg(message,'.'); // Finally, display feedback
    console.log('Added kickme for '+name);
}

/*
 * rem_kick_me: Removes all kick me notes for a user
 * id: Hex ID of user
 * name: Properly capitalized name of user
 * speak: Whether to inform the kickme has been removed
 * returns: none
 */
function rem_kick_me(id, name, speak) {
    if (g_kicks[id] && !g_brbs[dj_type][id]) { // If the user has a kick
	if (g_to_kick == id) {
	    g_to_kick = '';
	}
	delete g_kicks[id];             // But no brb, delete kick
	if (speak) {                  // Only speak when directed!
	    msg('OK, I won\'t kick you now','.');
	}
	console.log('Removed kickme for '+name);
    }
}

/*
 * check_kick_mes: Updates kick me list based on arg
 * arg: Either 'q' or hex ID of a user
 *     - If 'q', finds the first kickable on q
 *     - If a user ID, decrements their song count
 * returns: true if a user was kicked
 *          false otherwise
 */
function check_kick_mes(arg) {
    var ret = false;            // Default to failure
    if (arg == 'q') {           // If type is 'on q'
	for (var id in g_kicks) { // Find the first
	    if (g_kicks[id].q) {
		g_kick_mark = id; // Mark user for smooth transition
		if (g_current_dj == id) {   // If user is currently playing
		    g_to_kick = g_current_dj; // Wait until next song
		}
		else {
		    ret = true;    // Otherwise, return success
		    bot.remDj(id); // Kick immediately
		}
		return ret;
	    }
	}
    }
    else { // If type is 'after x songs', input is user id
	var id = arg;
	var name = get_user_info_r(id).name;
	if (!g_kicks[id]) { // If no kicks present, just quit
	    return ret;
	}
	var num_songs = g_kicks[id].songs; // Get number of songs left
	if (num_songs) { // If it's still positive
	    num_songs--; // Decrement
	    g_kicks[id].songs = num_songs; // And overwrite
	}
	if (num_songs === 0) { // Otherwise if it's 0
	    rem_brb(id, name);      // Remove any brb
	    if (g_current_dj == id) { // If user is currently playing
		g_to_kick = id;       // Wait until next song
	    }
	    else {
		ret = true;         // Otherwise, return success
		bot.remDj(id);      // Kick immediately
	    }
	}
    }
    return ret;
}

/*
 * set_limit: Sets a limit on the max number of songs
 * sender: OPTIONAL Hex ID of requestor
 * arg: Either a number (as a string) or the string "off"
 * return: none
 */
function set_limit(sender, arg) {
    // MODS ONLY!!!!! >:C
    if (sender && !is_mod(sender)) {
	return;
    }
    // Set the global song limit
    // If arg does not contain a number, limit is set to NaN
    var tmp_limit
    if (tmp_limit = parseInt(arg)) {
	// If there's no reason to limit plays, complain
	if (g_num_djs + g_num_spots + g_num_active_q <= g_max_djs) {
	    bot.pm('There\'s no queue. I refuse :P', sender);
	    return;
	}
	g_song_limit = tmp_limit;
	for (var i in g_djs) {
            // If a dj won't be kicked before the new song limit,
            // Reset song limit to new global limit
	    if (!g_kicks[g_djs[i]]) {
		g_kicks[g_djs[i]] = {};	 
	    }
	    if (g_kicks[g_djs[i]].songs > g_song_limit) {
		g_kicks[g_djs[i]].songs = g_song_limit;
	    }
	}
	msg('New song limit: '+g_song_limit,'.');
    }
    else {
	if (g_song_limit) {
	    msg('Song limit has been turned off ',':)');
	}
	g_song_limit = 0;
	for (var i in g_djs) {
	    delete g_kicks[g_djs[i]].songs;
	}
    }
}

/*
 * rem_from_queue: Properly removes a user from the queue
 *      - Removes away coverage
 *      - Removes user from queue
 *      - Calls next in queue if necessary
 * id: Hex ID of user
 * return: none
 */
function rem_from_queue(id) {
    for (var i = 0; i < g_queue.length; i++) {   // Find the user in the queue
	if (g_queue[i].id == id) {
	    console.log('Removing '+g_queue[i].name+' from spot '+(i+1));
	    g_queue.splice(i,1);	               // Remove from the queue
	    if (g_on_call && id == g_on_call.id) { // If the user is on call
		g_on_call = null;		       // Reset calling variables
		clearTimeout(g_call_timer);
		g_call_timer = null;
	    }
	    if (g_num_spots > 0) {               // If there are spots available
		call_next();		       // Call next on queue
	    }
	    g_num_active_q = g_queue.length - obj_size(g_brbs[q_type]);
	    if (g_kick_mark) {      // If someone has an 'on q' kick in store.
		g_kick_mark = '';   // Reset markers
		g_to_kick = '';
		if (g_num_active_q > g_num_spots) {  // If there are more on q than spots open
		    check_kick_mes('q');             // Check for an 'on q' kick me
		}	
	    }
	    return;
	}
    }
}

/*
 * snag_song: Snags the current song - MOD ONLY
 * sender: OPTIONAL - Hex ID of requestor
 * return: none
 */
function snag_song(sender) {
    var idx;
    if (!g_current_song) {
	console.log('Error snagging song: No song playing!');
	return;
    }
    if (sender && !is_mod(sender)) {
	return;
    }
    bot.snag();
    bot.playlistAll(function (list_data) {
	// If the playlist is corrupt, there's nothing we can do
	if(list_data.err) {
	    console.log(list_data.err);
	}
	else {
	    idx = list_data.list.length;
	    bot.playlistAdd(g_current_song, idx);
	}
    });
}