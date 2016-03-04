var l = require('./library-of-babel.js')
// dispatcher is the backbone of the app
// all local events bubble up to the dispatcher
var EE = require('events').EventEmitter
var dispatcher = new EE()
var config = {
  signalhubs: [
    'http://verdigris.ischool.berkeley.edu:4889',
  ],
}
var swarm = connectToSwarm(config.signalhubs)

// we handle dispatcher events (wire them to changes in store)
// inside the special Through module
function Through () {
	var Kefir = require('kefir')
	function s (ev) {
		return Kefir.fromEvents(dispatcher, ev)
  }

	var peerListS       = s('peer-list')
  var myMessageS      = s('send-my-message')
	var messageLogS     = s('peer-data')
													//.filter(d => d.type==='message')
                          .merge(myMessageS.map(function (m) {
                            return { 
                              peerID: "me", 
                              message: m 
                            }
													}))
                          .scan(l.append, [])

  // side effects
	// TODO show list of peers
  peerListS.log('peerlist')
  // post my messages
  myMessageS.onValue(m => 
		swarm.message({
			type: 'message',
      message: m,
		}))

  // return a stream of messag logs
  return messageLogS
}




// web rtc stuff
function connectToSwarm (urls) {
  var swarm = require('webrtc-swarm')
  var signalhub = require('signalhub')
	// setup signalhub with the urls
  var hub = signalhub('swarm-example', urls) 
 	// make a new swarm with our hub 
  var sw = swarm(hub)


	// when a new peer connects,
  sw.on('peer', function (peer, id) {
		// emit a peer-list event with the new list of peers
    dispatcher.emit('peer-list', sw.peers)
    // set up new liseners for this peer
    peer.on('data', data => {
      var o = JSON.parse(data)
      o.peerID = id
			dispatcher.emit('peer-data', o)
		})
  })
  
  // method for sending messages to all peers
  function messageAllPeers (obj) {
    var j = JSON.stringify(obj)
    sw.peers.forEach(p => p.send(j))
  }

	return {
		swarm: sw,
		message: messageAllPeers,
  }
}



// actions
function actions (swarmConn) {
	// sends { message: 'str' } to all peers
	// where 'str' is target.value
	function send (target) {
	  swarmConn.message({ message: v }) // send message to all peers
	  return v             // return content
	}
	
	dispatcher.on('keyup', (ev) => {
	    send(ev.target)
	})
}





// view stuff
var h = require('virtual-dom/h')
var main = require('main-loop')

function render (state) {

  return h('div', [
    h('div', state.map(messageDiv)),
    h('input', { 
// TODO this keyup could be app-wide
      onkeyup: handleInputKeyup, 
      autofocus: true,
		})
  ])

  function messageDiv (data) {
		return h('div.message', [
		  h('span.senderID', `${data.peerID}: `),
		  h('span.message', data.message),
		])
  }

  // emits send-message when user presses enter in input area
	function handleInputKeyup (ev) {
		// if it's the enter key
		if (ev.which === 13) {
	// TODO this should really update some local state atom
		  var v = ev.target.value // get input content
			// if there's content here
			if (v) {
		  	ev.target.value = ''    // clear input target
				dispatcher.emit('send-my-message', v) // emit send-my-message
			}
		}
	return
	}
}



// setup
var stateS = Through()
var loop = main([], render, require('virtual-dom'))
document.querySelector('#app').appendChild(loop.target)
stateS.onValue(loop.update)


