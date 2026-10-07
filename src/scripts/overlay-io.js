const WS = require("ws")
const http = require("http")

var wss = null
var webSocket = null
var overlayConnected = false

export function sendToOverlay(data, replyExpected = false) {
	new Event()

}