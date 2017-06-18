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
  attach_hash_listener(client, name, function() {
    arguments[0] = arguments[0] + "\t";
    console.log.apply(console, arguments);
  });
  attach_readline_interface(function(line) {
    var got = process_received_packet(client, make_packet(line, client.keys));
    if (got) {
      console.log.apply(console, got);
    }
  });
}

// client datastructure

function make_client(name, opts) {
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
  struct.client = opts.client || new WebTorrent();
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
      //console.log("repeat", uid);
      debug("ignoring repeat packet");
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
    //console.log("t.onExtendedHandshake", handshake);
    if (handshake.m && handshake.m[EXT]) {
      wire.fingerprint = fingerprint_key(handshake.pk);
      client.wires.push(wire);
      console.log("peer\t", wire.fingerprint);
      debug("wires:", client.wires.length);
    }
  }
  t.prototype.onMessage = function(message) {
    debug("raw:", message);
    debug("wire:", wire.fingerprint);
    if (wire.fingerprint) {
      var packet = bencode.decode(message);
      cb(packet, wire);
    }
  }
  return t;
}

function attach_hash_listener(client, name, cb) {
  var content = new Buffer(name);
  content.name = name;
  
  client.client.on('torrent', function(torrent) { 
    cb("hash", torrent.infoHash);
  });
  
  var torrent = client.client.seed(content, function (torrent) {
    cb("open");
  });
  
  torrent.on("wire", function(wire, addr) {
    debug("saw wire:", wire.peerId);
    wire.use(attach_bittorrent_extension_protocol(client, wire, addr, function(packet, wire) {
      var got = process_received_packet(client, packet, wire);
      if (got) {
        cb.apply(null, got);
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

// manage stdin interface in CLI mode

function attach_readline_interface(cb) {
  var readline = require('readline');
  
  var rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', function(line) {
    //console.log("line", line);
    cb(line);
  });

  rl.on('close', function() {
    console.log("exiting");
    process.exit(0);
  });
}

if (typeof require != 'undefined' && require.main==module) {
  main(process.argv);
} else {
  // node module defines
}
