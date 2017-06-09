#!/usr/bin/env node

var EXT = "dt_share";

var WebTorrent = require('webtorrent');
var readline = require('readline');
var uuid = require('uuid');
var bencode = require('bencode');

var client = new WebTorrent();
var rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

console.log("id", client.peerId);

var id = process.argv.pop();
var content = new Buffer(id);
content.name = id;

wires = [];

function post(payload) {
  var packet = {u: uuid(), p: payload.toString()};
  wires.map(function(wire) {
    wire.extended(EXT, packet);
  });
}

rl.on('line', function(line) {
  //console.log("LINE!", line);
  post(line);
});

rl.on('close', function() {
  console.log("exit");
  process.exit(0);
});

function make_protocol(wire, addr) {
  var t = function(wire) {
    // TODO: change/remove this
    //wire.extendedHandshake.test = 'Hello, World!'
  };
  t.prototype.name = EXT;
  t.prototype.onHandshake = function (infoHash, peerId, extensions) {
    //console.log("t.onHandshake", infoHash, peerId);
    //console.log("t.onHandshake extensions", extensions);
  }
  t.prototype.onExtendedHandshake = function (handshake) {
    //console.log("t.onExtendedHandshake", handshake);
    if (handshake.m && handshake.m[EXT]) {
      console.log("peer", wire.peerId);
      wires.push(wire);
    }
  }
  t.prototype.onMessage = function(message) {
    var packet = bencode.decode(message);
    console.log(wire.peerId, packet["p"].toString());
  }
  return t;
}

//client.on('ready', function() {
//  console.log("ready", arguments);
//});

client.on('torrent', function(torrent) { 
  console.log("torrentHash", torrent.infoHash);
});

var torrent = client.seed(content, function (torrent) {
  console.log('live', torrent.infoHash)
});

torrent.on("wire", function(wire, addr) {
  console.log("wire", wire.peerId, addr);
  wire.use(make_protocol(wire, addr));
  wire.on("handshake", function() {
    //console.log("Handshake wire", arguments);
  });
  wire.on("close", function() {
    console.log("close", wire.peerId);
    wires.filter(function(w) { return w != wire; });
  });
});

