#!/usr/bin/env node

var EXT = "dt_share";

var WebTorrent = require('webtorrent');
var bencode = require('bencode');
var nacl = require('tweetnacl');
var ripe = require('ripemd160');
var debug = require('debug')('dreamtime');

// CLI main function

function main(args) {
  var name = args.pop();
  var client = make_client();
  console.log("me\t", client.fingerprint);
  // handle data from peers to stdout
  listen(client, name, post_to_stdout);
  // send stdin to peers
  attach_readline_interface(function(type, data) {
    if (type == "line") {
      send(client, data, post_to_stdout);
    } else if (type == "exit") {
      console.log("exiting");
    }
  });
}

function post_to_stdout() {
  var args = Array.prototype.slice.call(arguments);
  args[0] = args[0] + "\t";
  console.log.apply(console, args);
}

// client datastructure

function make_client(opts) {
  var opts = opts || {};
  var struct = {
    // peer connections
    "wires": [],
    // messages already seen recently
    "seen": [],
    "seenptr": 0,
  };
  // how many recent messages to detect repeats (rinngbuffer)
  struct.seen.length = 1024;
  // webtorrent client
  struct.torrent_client = opts.torrent_client || new WebTorrent();
  // nacl key pair
  struct.keys = opts.keys || nacl.sign.keyPair();
  // compute my pk and fingerprint
  struct.pk = Buffer(struct.keys.publicKey);
  struct.fingerprint = fingerprint_key(struct.pk);
  return struct;
}

// crypto & utility functions

function fingerprint_key(pk) {
  return new ripe().update(Buffer(pk)).digest('hex');
}

function make_packet(payload, keys) {
  var packet = {k: Buffer(keys.publicKey), u: Buffer(nacl.randomBytes(20)), p: Buffer(payload.toString())};
  packet.s = Buffer(nacl.sign.detached(Buffer(packet.k + packet.u + packet.p), keys.secretKey));
  return packet;
}

function process_received_packet(client, packet, wire) {
  var verified = nacl.sign.detached.verify(Buffer(packet.k + packet.u + packet.p), new Uint8Array(packet.s), new Uint8Array(packet.k));
  debug("verified:", verified);
  debug("packet:", packet);
  if (verified) {
    var uid = packet.k + packet.u;
    // check if this is a repeat packet
    if (client.seen.indexOf(uid) == -1) {
      client.seen[client.seenptr] = uid;
      client.seenptr = (client.seenptr + 1) % client.seen.length;
      client.wires.map(function(w) {
        if (w != wire) {
          w.extended(EXT, packet);
        }
      });
      return ["msg", fingerprint_key(packet.k), packet["p"].toString()];
    } else {
      debug("ignoring repeat packet");
    }
  }
}

function send(client, message, cb) {
  if (client.torrent) {
    var got = process_received_packet(client, make_packet(message, client.keys));
    if (got) {
      cb.apply(null, got);
    }
  }
}

// interface to bittorrent client

function attach_bittorrent_extension_protocol(client, wire, addr, cb) {
  var t = function(wire) {
    wire.extendedHandshake.pk = client.pk;
  };
  t.prototype.name = EXT;
  t.prototype.onExtendedHandshake = function (handshake) {
    if (handshake.m && handshake.m[EXT]) {
      wire.fingerprint = fingerprint_key(handshake.pk);
      client.wires.push(wire);
      cb("peer", wire);
      debug("wires:", client.wires.length);
    }
  }
  t.prototype.onMessage = function(message) {
    debug("raw:", message);
    debug("wire:", wire.fingerprint);
    if (wire.fingerprint) {
      var packet = bencode.decode(message);
      cb("packet", wire, packet);
    }
  }
  return t;
}

function listen(client, name, cb) {
  if (client.torrent) {
    disconnect(client);
  }
  
  var content = new Buffer("\0");
  content.name = name;
  
  client.torrent_client.on('torrent', function(torrent) { 
    cb("hash", torrent.infoHash);
    client.torrent = torrent;
  });
  
  var torrent = client.torrent_client.seed(content, function (torrent) {
    cb("open");
  });
  
  torrent.on("wire", function(wire, addr) {
    debug("saw wire:", wire.peerId);
    wire.use(attach_bittorrent_extension_protocol(client, wire, addr, function(type, wire, packet) {
      if (type == "packet") {
        var got = process_received_packet(client, packet, wire);
        if (got) {
          cb.apply(null, got);
        }
      } else if (type == "peer") {
        cb(type, wire.fingerprint);
      }
    }));
    wire.on("close", function() {
      wires = client.wires.filter(function(w) { return w != wire; });
      if (wire.fingerprint) {
        cb("left", wire.fingerprint);
        debug("wires:", client.wires.length);
      }
    });
  });
}

function disconnect(client) {
  if (client.torrent) {
    client.torrent_client.remove(client.torrent);
    client.torrent = null;
  }
}

// manage stdin interface in CLI mode

function attach_readline_interface(cb) {
  var readline = require('readline');
  
  var rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', function(line) {
    cb("line", line);
  });

  rl.on('close', function() {
    cb("exit");
    process.exit(0);
  });
}

// node module interface
function connect(room, opts, cb) {
  if (typeof(opts) == "function") {
    cb = opts;
    opts = {};
  }
  var c = make_client(opts);
  listen(c, room, cb);
  return {
    "client": c,
    "send": function(msg) {
      send(c, msg, cb);
    },
    "disconnect": function() {
      disconnect(c);
    }
  };
}

if (typeof(require)!= 'undefined' && require.main == module) {
  main(process.argv);
} else {
  // node module defines
  module.exports = connect;
}
