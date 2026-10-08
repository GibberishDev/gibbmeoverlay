import * as WS from "ws"
import * as http from "http"
import { GibbLogger } from './logger.js'
// import * as GibbLogger from "./logger"

const LOGGER = new GibbLogger("OverlayIO")

/** @namespace OverlayIO */
var wss = null
var webSocket = null
var overlayConnected = false
var server
let overlays = {}
let unconfirmedClients = []

/**
 * ENUM for WebSocket message types that back-end receives from overlay
 * @enum {String}
 * @readonly
 * @memberof OverlayIO
 */
export const OVERLAY_MESSAGE_TYPES = {
	/** Undefined or not specified */
	UNDEFINED : "UNDEFINED",
	/** Handshake message received when client attempts to connect to host. Message contains client uuid */
	HANDSHAKE : "HANDSHAKE"
}

export function startWebSocketServer() {
	wss = new WS.WebSocketServer({
		host:"127.0.0.1",
		port: 10302//settings get ws port
	})
	LOGGER.log(`Started WebSocket server at "127.0.0.1":${10302}`)
	wss.on("connection",(client)=>{
		unconfirmedClients.push(client)
		client.on("message", (data)=>{
			handleWebsocketMessage(client, data)
		})
		client.on("close", (client, code, reason)=>{
			handleClientDisconnected(client, code, reason)
		})
	})
	server = http.createServer((req, res) => {
		res.setHeader("Access-Control-Allow-Origin","*")
		if (req.url==="/api/state") {
			res.writeHead(200, {"content-type":"text/json; charset=utf-8"})
			res.end(JSON.stringify({}))
		}
	})
	LOGGER.log(`Hosted http api endpoint at "127.0.0.1":${10301}/api/state`)
	server.listen(10301, "127.0.0.1")
}

function handleWebsocketMessage(client, data) {
	data = JSON.parse(data)
	if (unconfirmedClients.includes(client) && data.type === OVERLAY_MESSAGE_TYPES.HANDSHAKE)  {
		if (Object.keys(overlays).includes(data.id)) {
			overlays[data.id].clients.push(client)
		} else {
			overlays[data.id] = {
				"clients":[client]
			}
		}
		unconfirmedClients.splice(unconfirmedClients.indexOf(client),1)
		sendToOverlay(JSON.stringify({
				type: OVERLAY_MESSAGE_TYPES.HANDSHAKE,
				message: "complete"
			}), data.id)
		// client.send(JSON.stringify({
		// 		type: OVERLAY_MESSAGE_TYPES.HANDSHAKE,
		// 		message: "complete"
		// 	}))
  		LOGGER.log(`New client for ${data.id} registered`)
	} else {

	}
}

function handleClientDisconnected(client, code, reason) {
	LOGGER.log(`Client ${overlays[client].id} disconnected with code: ${code}`)
	delete overlays[client]
}

export function sendToOverlay(data, overlayID, replyExpected = false) {
	if (Object.keys(overlays).includes(overlayID)) {
		let clients = overlays[overlayID].clients
		clients.forEach((client)=>{
			client.send(data)
		})
	} else {
		console.warn(`No overlays with uuid "${overlayID}" are currently active`)
	}

}