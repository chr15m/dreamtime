Peer-to-peer networking for shell scripts & OS pipes.

	npm install chr15m/dreamtime

![Screencast of dreamtime connecting to two servers and local](./screencast.gif)

### Run

	./node_modules/.bin/dreamtime unique-room-identifier

Example: aggregate the output from `ping` from different servers:

`ping -n wikipedia.org | stdbuf -oL cut -b15- | dreamtime ping-party`

![Screencast of dreamtime aggregating script output](./screencast-2.gif)

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

### Security note

Channels are completely public. Anybody can join or eavesdrop. Don't share secrets over them.

