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

const namespaces = io.of(/^\/[0-9]{7}$/);

namespaces.on('connect', function(socket) {

  const namespace = socket.nsp;
  console.log(`    Socket namespace: ${namespace.name}`);

  socket.broadcast.emit('connected peer');

  socket.on('signal', function(data) {
    socket.broadcast.emit('signal', data);
  });

  socket.on('disconnect', function() {
    namespace.emit('disconnected peer');
  });

});

const mp_namespaces = io.of(/^\/[a-z]{4}\-[a-z]{4}\-[a-z]{4}$/);

mp_namespaces.on('connect', function(socket) {

  const namespace = socket.nsp;

  const peers = [];

  for (let peer of namespace.sockets.keys()) {
    peers.push(peer);
  }
  console.log(`    Socket namespace: ${namespace.name}`);

  // Send the array of connected-peer IDs to the connecting peer
  socket.emit('connected peers', peers);

  // Send the connecting peer ID to all connected peers
  socket.broadcast.emit('connected peer', socket.id);

  socket.on('signal', function({ recipient, sender, signal }) {
    socket.to(recipient).emit('signal', { recipient, sender, signal });
  });

  socket.on('disconnect', function() {
    namespace.emit('disconnected peer', socket.id);
  });

});

/**
 *  End of the main monkey business.
 */

// Export the Express app and Socket.io instances for use in
// /scripts/start-server:
module.exports = {app, io, public_dir};
