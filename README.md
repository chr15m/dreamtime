Peer-to-peer networking for shell scripts & OS pipes.

	npm install chr15m/dreamtime

![Screencast of dreamtime connecting to two servers and local](./screencast.gif)

### Run

	./node_modules/.bin/dreamtime unique-room-identifier

Example: aggregate the output from `ping` from different servers:

`ping -n wikipedia.org | stdbuf -oL cut -b15- | dreamtime ping-party`

![Screencast of dreamtime aggregating script output](./screencast-2.gif)

### Implementation

Dreamtime is built on top of [WebTorrent](https://webtorrent.io/) and uses the Bittorrent extension protocol for messaging.

### Security note

Channels are completely public. Anybody can join or eavesdrop. Don't share secrets over them.

