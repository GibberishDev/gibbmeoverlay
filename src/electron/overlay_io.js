import * as WS from "ws"
import * as http from "http"
import { GibbLogger } from './logger.js'
import { CQT } from "./cqt.js"
// import * as GibbLogger from "./logger"

const LOGGER = new GibbLogger("OverlayIO")
const cqt = new CQT()

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
	LOGGER.log(`Started WebSocket server at "127.0.0.1":${10302}`, "WebSocket")
	wss.on("connection",(client)=>{
		unconfirmedClients.push(client)
		client.on("message", (data)=>{
			handleWebsocketMessage(client, data)
		})
	})
	server = http.createServer((req, res) => {
		res.setHeader("Access-Control-Allow-Origin","*")
		if (req.url==="/api/state") {
			res.writeHead(200, {"content-type":"text/json; charset=utf-8"})
			res.end(JSON.stringify({}))
		}
	})
	LOGGER.log(`Hosted http api endpoint at "127.0.0.1":${10301}/api/state`, "HTTP Server")
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
		client.on("close",(client, code, reason)=>{
			handleClientDisconnected(data.id, client, code, reason)
		})
		unconfirmedClients.splice(unconfirmedClients.indexOf(client),1)
		sendToOverlay(JSON.stringify({
				type: OVERLAY_MESSAGE_TYPES.HANDSHAKE,
				message: "complete"
			}), data.id)
		// client.send(JSON.stringify({
		// 		type: OVERLAY_MESSAGE_TYPES.HANDSHAKE,
		// 		message: "complete"
		// 	}))
  		LOGGER.log(`New client registered for overlay with id "${data.id}"`, "WebSocket")
	} else {

	}
}

function handleClientDisconnected(id, client, code, reason) {
	LOGGER.log(`Client for overlay with id "${id}" disconnected with code: ${code}`, "WebSocket")
	overlays[id].clients.splice(overlays[id].clients.indexOf(client))
	if (overlays[id].clients.length == 0) {
		delete overlays[id]
		LOGGER.log(`No active clients left for overlay with id: ${id}`, "WebSocket")
	}
	console.log(LOGGER.getHistory())
}

export function sendToOverlay(data, overlayID, replyExpected = false) {
	if (Object.keys(overlays).includes(overlayID)) {
		let clients = overlays[overlayID].clients
		clients.forEach((client)=>{
			client.send(data)
		})
	} else {
		console.warn(`No overlays with uuid "${overlayID}" are currently active`, "WebSocket")
	}

}