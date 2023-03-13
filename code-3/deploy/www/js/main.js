/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
***/
'use strict';

/**
 *  Global Variables: $self and $peers
 */

const $self = {
  rtcConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  },
  mediaConstraints: { audio: true, video: true }
};

const $peers = new Map();


/**
 *  Signaling-Channel Setup
 */

const namespace = prepareNamespace(window.location.hash, true);

const sc = io.connect('/' + namespace, { autoConnect: false });

registerScCallbacks();



/**
 * =========================================================================
 *  Begin Application-Specific Code
 * =========================================================================
 */


/**
 *  User-Interface Setup
 */

document.querySelector('#header h1')
  .innerText = 'Welcome to Room #' + namespace;

document.querySelector('#call-button')
  .addEventListener('click', handleCallButton);

document.querySelector('#username-form')
  .addEventListener('submit', handleUsernameForm);


/**
 *  User Features and Media Setup
 */

requestUserMedia($self.mediaConstraints);



/**
 *  User-Interface Functions and Callbacks
 */

function handleCallButton(event) {
  const callButton = event.target;
  if (callButton.className === 'join') {
    console.log('Joining the call...');
    callButton.className = 'leave';
    callButton.innerText = 'Leave Call';
    joinCall();
  } else {
    console.log('Leaving the call...');
    callButton.className = 'join';
    callButton.innerText = 'Join Call';
    leaveCall();
  }
}

function joinCall() {
  sc.open();
}

function leaveCall() {
  sc.close();
  for (let id of $peers.keys()) {
    resetPeer(id);
  }
}

function handleUsernameForm(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.querySelector('#username-input').value;
  const figcaption = document.querySelector('#self figcaption');
  figcaption.innerText = username;
  $self.username = username;
  // share username when set by self
  for (let id of $peers.keys()) {
    shareUsername(username, id);
  }
}

/**
 *  User-Media and Data-Channel Functions
 */

async function requestUserMedia(media_constraints) {
  $self.mediaStream = new MediaStream();
  $self.media = await navigator.mediaDevices
    .getUserMedia(media_constraints);
  for (let track of $self.media.getTracks()) {
      $self.mediaStream.addTrack(track);
  }
  displayStream($self.mediaStream, '#self');
}

function createVideoElement(id) {
  const figure = document.createElement('figure');
  const figcaption = document.createElement('figcaption');
  const video = document.createElement('video');
  const attributes = {
    autoplay: '',
    playsinline: '',
    poster: 'img/placeholder.png'
  };
  // Set attributes
  figure.id = `peer-${id}`;
  figcaption.innerText = id;
  for (let attr in attributes) {
    video.setAttribute(attr, attributes[attr]);
  }
  // Append the video and figcaption elements
  figure.appendChild(video);
  figure.appendChild(figcaption);
  // Return the complete figure
  return figure;
}

function displayStream(stream, selector) {
  let videoElement = document.querySelector(selector);
  let video;
  if (!videoElement) {
    const id = selector.replace(/^#peer-/, ''); // remove `#peer-` portion
    const videos = document.querySelector('#videos');
    videoElement = createVideoElement(id);
    videos.appendChild(videoElement);
  }
  video = videoElement.querySelector('video');
  video.srcObject = stream;
}

function addStreamingMedia(stream, id) {
  const peer = $peers.get(id);
  if (stream) {
    for (let track of stream.getTracks()) {
      peer.connection.addTrack(track, stream);
    }
  }
}

function shareUsername(username, id) {
  console.log(`Attempt to send username to peer ID: ${id}`);
  const peer = $peers.get(id);
  const udc = peer.connection.createDataChannel(`username-${username}`);
}

/**
 *  Call Features & Reset Functions
 */

function establishCallFeatures(id) {
  registerRtcCallbacks(id);
  addStreamingMedia($self.mediaStream, id);
  // share self username if already set
  if ($self.username) {
    shareUsername($self.username, id);
  }
}

function resetPeer(id, preserve) {
  const peer = $peers.get(id);
  const videoElement = `#peer-${id}`;
  displayStream(null, videoElement);
  peer.connection.close();
  if (!preserve) {
    document.querySelector(videoElement).remove();
    $peers.delete(id);
  }
}


/**
 *  WebRTC Functions and Callbacks
 */

function registerRtcCallbacks(id) {
  const peer = $peers.get(id);
  peer.connection
    .onconnectionstatechange = handleRtcConnectionStateChange(id);
  peer.connection
    .onnegotiationneeded = handleRtcConnectionNegotiation(id);
  peer.connection
    .onicecandidate = handleRtcIceCandidate(id);
  peer.connection
    .ontrack = handleRtcPeerTrack(id);
  peer.connection
    .ondatachannel = handleRTCDataChannel(id);
}

function handleRtcPeerTrack(id) {
  return function({ track, streams: [stream] }) {
    console.log(`Attempt to display media from peer ID: ${id}`);
    displayStream(stream, `#peer-${id}`);
  };
}

function handleRTCDataChannel(id) {
  return function({ channel }) {
    const label = channel.label;
    if (label.startsWith('username-')) {
      document.querySelector(`#peer-${id} figcaption`)
        .innerText = label.split('username-')[1];
      channel.onopen = function() {
        channel.close();
      };
    }
  };
}


/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */


/**
 *  Reusable WebRTC Functions and Callbacks
 */
function handleRtcConnectionNegotiation(id) {
  return async function() {
    const peer = $peers.get(id);
    const selfState = peer.selfStates;
    if (selfState.isSuppressingInitialOffer) return;
    try {
      selfState.isMakingOffer = true;
      await peer.connection.setLocalDescription();
    } catch(e) {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
    } finally {
      sc.emit('signal',
        { to: id, from: $self.id,
          signal: { description: peer.connection.localDescription } });
      selfState.isMakingOffer = false;
    }
  };
}

function handleRtcIceCandidate(id) {
  return function({ candidate }) {
    if (candidate) {
      console.log(`Handling ICE candidate, type '${ candidate.type }'...`);
    }
    sc.emit('signal', { to: id, from: $self.id,
      signal: { candidate } });
  };
}

function handleRtcConnectionStateChange(id) {
  return function() {
    const peer = $peers.get(id);
    const connectionState = peer.connection.connectionState;
    // Assume *some* element will take a unique peer ID
    const peerElement = document.querySelector(`#peer-${id}`);
    if (peerElement) {
      peerElement.dataset.connectionState = connectionState;
    }
    console.log(`Connection state '${connectionState}' for Peer ID: ${id}`);
  };
}



/**
 *  Signaling-Channel Functions and Callbacks
 */

function registerScCallbacks() {
  sc.on('connect', handleScConnect);
  sc.on('connected peers', handleScConnectedPeers);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('disconnected peer', handleScDisconnectedPeer);
  sc.on('signal', handleScSignal);
}

function handleScConnect() {
  console.log('Successfully connected to the signaling server!');
  $self.id = sc.id;
  console.log(`Self ID: ${$self.id}`);
}

function handleScConnectedPeers({ peers, credentials }) {
  const ids = peers;
  console.log(`Connected peer IDs: ${ids.join(', ')}`);

  console.log(`TURN Credentials: ${JSON.stringify(credentials)}`);
  // addCredentialedTurnServer('turn:coturn.example.com:3478', credentials);

  for (let id of ids) {
    if (id !== $self.id) {
      // be polite with already-connected peers
      initializePeer(id, true);
      establishCallFeatures(id);
    }
  }
}

function handleScConnectedPeer(id) {
  console.log(`Newly connected peer ID: ${id}`);
  // be impolite with each newly connecting peer
  initializePeer(id, false);
  establishCallFeatures(id);
}

function handleScDisconnectedPeer(id) {
  console.log(`Disconnected peer ID: ${id}`);
  resetPeer(id);
}

function initializePeer(id, polite) {
  $peers.set(id, {
    connection: new RTCPeerConnection($self.rtcConfig),
    selfStates: {
      isPolite: polite,
      isMakingOffer: false,
      isIgnoringOffer: false,
      isSettingRemoteAnswerPending: false,
      isSuppressingInitialOffer: false
    }
  });
}

function resetAndRetryConnection(id) {
  const polite = $peers.get(id).selfStates.isPolite;
  resetPeer(id, true);
  initializePeer(id, polite);
  $peers.get(id).selfStates.isSuppressingInitialOffer = polite;

  establishCallFeatures(id);

  if (polite) {
    sc.emit('signal', { to: id, from: $self.id,
      signal: { description: { type: '_reset' } } });
  }
}

async function handleScSignal({ from,
  signal: { candidate, description } }) {

  const id = from;
  const peer = $peers.get(id);
  const selfState = peer.selfStates;

  if (description) {
    if (description.type === '_reset') {
      console.log(`***** Received a signal to reset from peer ID: ${id}`);
      resetAndRetryConnection(id);
      return;
    }

    const readyForOffer =
          !selfState.isMakingOffer &&
          (peer.connection.signalingState === 'stable'
            || selfState.isSettingRemoteAnswerPending);

    const offerCollision = description.type === 'offer' && !readyForOffer;

    selfState.isIgnoringOffer = !selfState.isPolite && offerCollision;

    if (selfState.isIgnoringOffer) {
      return;
    }

    selfState.isSettingRemoteAnswerPending = description.type === 'answer';

    try {
      console.log(`Signaling state '${peer.connection.signalingState}' on
        incoming description for peer ID: ${id}`);
      await peer.connection.setRemoteDescription(description);
    } catch(e) {
      console.log(`***** Resetting and signaling same to peer ID: ${id}`);
      resetAndRetryConnection(id);
      return;
    }

    selfState.isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      try {
        await peer.connection.setLocalDescription();
      } catch(e) {
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
      } finally {
        sc.emit('signal', { to: id, from: $self.id, signal:
          { description: peer.connection.localDescription } });
        selfState.isSuppressingInitialOffer = false;
      }
    }
  } else if (candidate) {
    // Handle ICE candidates
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch(e) {
      // Log error unless state is ignoring offers
      // and candidate is not an empty string
      if (!selfState.isIgnoringOffer && candidate.candidate.length > 1) {
        console.error(`Unable to add ICE candidate for peer ID: ${id}.`, e);
      }
    }
  }
}



/**
 *  Utility Functions
 */

function addCredentialedTurnServer(server_string, { username, password }) {
  // Add TURN server and credentials to iceServers array
  $self.rtcConfig.iceServers.push({
    urls: server_string,
    username: username,
    password: password
  });
}

function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[a-z]{4}-[a-z]{4}-[a-z]{4}$/.test(ns)) {
    console.log(`Checked existing namespace '${ns}'`);
    return ns;
  }
  ns = generateRandomAlphaString('-', 4, 4, 4);
  console.log(`Created new namespace '${ns}'`);
  if (set_location) window.location.hash = ns;
  return ns;
}

function generateRandomAlphaString(separator, ...groups) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let ns = [];
  for (let group of groups) {
    let str = '';
    for (let i = 0; i < group; i++) {
      str += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    ns.push(str);
  }
  return ns.join(separator);
}
