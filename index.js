#!/usr/bin/env node

var EXT = "dt_share";

var WebTorrent = require('webtorrent');
var readline = require('readline');
var bencode = require('bencode');
var nacl = require('tweetnacl');
var ripe = require('ripemd160');
var debug = require('debug')('dreamtime')

var wires = [];
var seen = [];
seen.length = 1024;
var seenptr = 0;

var client = new WebTorrent();

var keys = nacl.sign.keyPair();
var pk = Buffer(keys.publicKey);

console.log("me\t", fingerprint_key(pk));

var id = process.argv.pop();
var content = new Buffer(id);
content.name = id;

function fingerprint_key(pk) {
  return new ripe().update(Buffer(pk)).digest('hex');
}

function make_packet(payload) {
  var packet = {k: Buffer(keys.publicKey), u: Buffer(nacl.randomBytes(20)), p: Buffer(payload.toString())};
  packet.s = Buffer(nacl.sign.detached(Buffer(packet.k + packet.u + packet.p), keys.secretKey));
  return packet;
}

function receive_packet(packet, wire) {
  var verified = nacl.sign.detached.verify(Buffer(packet.k + packet.u + packet.p), new Uint8Array(packet.s), new Uint8Array(packet.k));
  debug("verified:", verified);
  debug("packet:", packet);
  if (verified) {
    var uid = packet.k + packet.u;
    if (seen.indexOf(uid) == -1) {
      // this is not a repeat packet
      console.log("msg\t", fingerprint_key(packet.k), packet["p"].toString());
      seen_add(uid);
      wires.map(function(w) {
        if (w != wire) {
          w.extended(EXT, packet);
        }
      });
    } else {
      //console.log("repeat", uid);
      debug("ignoring repeat packet");
    }
  }
}

function seen_add(v) {
  seen[seenptr] = v;
  seenptr = (seenptr + 1) % seen.length;
}

var rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', function(line) {
  //console.log("line", line);
  receive_packet(make_packet(line), null);
});

rl.on('close', function() {
  console.log("exiting");
  process.exit(0);
});

function attach_protocol(wire, addr) {
  var t = function(wire) {
    wire.extendedHandshake.pk = pk;
  };
  t.prototype.name = EXT;
  t.prototype.onExtendedHandshake = function (handshake) {
    //console.log("t.onExtendedHandshake", handshake);
    if (handshake.m && handshake.m[EXT]) {
      wire.fingerprint = fingerprint_key(handshake.pk);
      wires.push(wire);
      console.log("peer\t", wire.fingerprint);
      debug("wires:", wires.length);
    }
  }
  t.prototype.onMessage = function(message) {
    debug("raw:", message);
    debug("wire:", wire.fingerprint);
    if (wire.fingerprint) {
      var packet = bencode.decode(message);
      receive_packet(packet, wire);
    }
  }
  return t;
}

client.on('torrent', function(torrent) { 
  console.log("hash\t", torrent.infoHash);
});

var torrent = client.seed(content, function (torrent) {
  console.log('live')
});

torrent.on("wire", function(wire, addr) {
  //console.log("wire", wire.peerId, addr);
  debug("saw wire:", wire.peerId);
  wire.use(attach_protocol(wire, addr));
  wire.on("close", function() {
    wires = wires.filter(function(w) { return w != wire; });
    if (wire.fingerprint) {
      console.log("left\t", wire.fingerprint);
      debug("wires:", wires.length);
    }
  });
});

