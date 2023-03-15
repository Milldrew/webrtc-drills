/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
***/
'use strict';

// Load up necessary modules
const crypto = require('crypto');

// snip, snip...

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const io = require('socket.io')();
// Create an Express app
const app = express();
// Set the public directory to serve from
const public_dir = process.env.PUBLIC ?? 'www';
// Log activity to the console
app.use(logger('dev'));
// Serve static files from the `www/` directory
app.use(express.static(path.join(__dirname, public_dir)));

// Catch 404 errors and forward them to error handler
app.use(function(req, res, next) {
  next(createError(404));
});
// Handle errors with the error handler
app.use(function(err, req, res, next) {
  // Set the error code
  res.status(err.status || 500);
  // Respond with a static error page (404 or 500)
  res.sendFile(`error/${err.status}.html`, { root: __dirname });
});

/**
 *  The main monkey business:
 *  Signaling with the socket server, Socket.io
 */

const mp_namespaces = io.of(/^\/[a-z]{4}\-[a-z]{4}\-[a-z]{4}$/);

mp_namespaces.on('connect', function(socket) {

  const namespace = socket.nsp;

  const expiry_in_hours = 4; // credentials last for four hours
  const secret = process.env.TURNSECRET || 'your secret goes here';
  const credentials = createCoturnCredentials(expiry_in_hours, secret);

  const peers = [];

  for (let peer of namespace.sockets.keys()) {
    peers.push(peer);
  }
  console.log(`    Socket namespace: ${namespace.name}`);

  // Send the array of connected-peer IDs and the TURN credentials
  // to the connecting peer
  socket.emit('connected peers', { peers, credentials });

  // Send the connecting peer ID to all connected peers
  socket.broadcast.emit('connected peer', socket.id);

  socket.on('signal', function({ to, from, signal }) {
    socket.to(to).emit('signal', { to, from, signal });
  });

  socket.on('disconnect', function() {
    namespace.emit('disconnected peer', socket.id);
  });

});

/**
 *  End of the main monkey business.
 */

function createCoturnCredentials(expiry_in_hours, secret) {
  // JavaScript timestamps are in milliseconds, so divide by 1000
  const now = Math.round(Date.now() / 1000);
  const expiry = (now + (expiry_in_hours * 60 * 60)).toString();
  const hmac = crypto.createHmac('sha1', secret);
  hmac.setEncoding('base64');
  hmac.write(expiry);
  hmac.end();
  return {
    username: expiry,
    password: hmac.read()
  };
}

// Export the Express app and Socket.io instances for use in
// /scripts/start-server:
module.exports = {app, io, public_dir};
