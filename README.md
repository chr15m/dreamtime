Peer-to-peer networking for shell scripts & OS pipes.

	npm install chr15m/dreamtime

### Run

	./node_modules/.bin/dreamtime unique-room-identifier

![Screencast of dreamtime connecting to two servers and local](./screencast.gif)

Aggregate the output from scripts on different servers.

![Screencast of dreamtime aggregating script output](./screencast-2.gif)

### Implementation

Dreamtime is built on top of [WebTorrent](https://webtorrent.io/) and uses the Bittorrent extension protocol for messaging.

### Security note

Channels are completely public. Anybody can join or eavesdrop. Don't share secrets over them.

