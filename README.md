Peer-to-peer networking for shell scripts & OS pipes.

	npm install chr15m/dreamtime

![Screencast of dreamtime connecting to two servers and local](./screencast.gif)

### Run

	./node_modules/.bin/dreamtime unique-room-identifier

Example: aggregate the output from `ping` from different servers:

`ping -n wikipedia.org | stdbuf -oL cut -b15- | dreamtime ping-party`

![Screencast of dreamtime aggregating script output](./screencast-2.gif)

For more options & help run `dreamtime` with no arguments.

### Node module

You can `require` dreamtime as a node module:

	// connect to a room with a callback for received messages
	room = require('dreamtime')("my-room-id", console.log);
	
	// our unique fingerprint
	console.log(c.client.fingerprint);
	
	// wait 5 seconds & send a message to the room
	// and then disconnect
	setTimeout(function() {
	  room.send("my first test message");
	  room.disconnect();
	}, 5000);

You can also re-use an existing webtorrent client:

	var dreamtime = require("dreamtime");
	room = dreamtime("my-room-id", {"torrent_client": wt}, console.log);

### Implementation

Dreamtime is built on top of [WebTorrent](https://webtorrent.io/) and uses the Bittorrent extension protocol for messaging.

Discovery is achieved by seeding a torrent with the following `info` field.

Contents are bencoded and SHA1'ed to make the infoHash as is standard.

	{"length": 1,
	 "name: YOUR-ROOM-NAME,
	 "piece length": 16384,
	 "pieces": 0x5b a9 3c 9d b0 cf f9 3f 52 b5 21 d7 42 0e 43 f6 ed a2 78 4f }

The content of the torrent is a single character `\0` and so the `pieces` field contains `sha1("\0")`.

### Security note

Channels are completely public. Anybody can join or eavesdrop. Don't share secrets over them.

