/** @namespace MediaInfo */

import * as dbus from '@jellybrick/dbus-next'
import * as os from 'os'
import { GibbLogger } from './logger.js'

// #region common

const LOGGER = new GibbLogger("MediaInfo")

export class MediaInfoInterface {
	constructor() {
		switch (os.platform()) {
			case 'linux' : {
				this.bindLinux()
				break
			}
			case 'win32' : {
				this.bindWindows()
				break
			}
		}
	}

	disconnect() {
		switch (os.platform()) {
			case 'linux' : {
				if (linuxMediaDBus) {
					linuxMediaDBus.disconnect()
					linuxMediaDBus = null
				}
				break
			}
			case 'win32' : {
				break
			}
		}
	}

	bindLinux(){
		this.getPlayingMedia = getPlayingMediaLinux
		this.listMediaPlayers = listMediaPlayersLinux
		linuxMediaDBus = dbus.sessionBus()
	}

	listMediaPlayers = async()=>{}
	getPlayingMedia = async()=>{}

}



// #endregion
// #region linux

// #region variables
const BUS = 'org.freedesktop.DBus'
const ROOT = '/org/freedesktop/DBus'
const MPRIS = 'org.mpris.MediaPlayer2'
const PLAYER = `${MPRIS}.Player`
const PROPERTIES = `org.freedesktop.DBus.Properties`

let linuxMediaDBus = null

async function getPlayingMediaLinux(playerName=null) {
	try {
		const players = await listMediaPlayersLinux()
		if (players.length < 1) {
			LOGGER.warn(`No active media player found`,"MPRIS")
			return
		}
		const results = {}
		for (let player of players) {
			try {
				const properties = await getPlayerMetadata(player)
				results[properties["playerName"]] = properties
			} catch (err) {
				LOGGER.error(`Error reading media info: ${err.message}`,"MPRIS")
			}
		}
		if (playerName) {
			return results[playerName]
		}
		return results
		
	} catch (err) {
		console.error(err)
	}
}

async function listMediaPlayersLinux() {
	const reply = await linuxMediaDBus.call(new dbus.Message({
		destination: BUS,
		path: ROOT,
		interface: BUS,
		member: 'ListNames'
	}));
	if (reply.type===dbus.MessageType.ERROR) {
		LOGGER.error(`Error getting list of media player names: ${reply.body?.[0]}`,"MPRIS")
		return[]
	}
	return reply.body[0].filter(name=>name.startsWith(`${MPRIS}.`))
}

async function messageDBus(destination, path, iface, member, signature='', body=[]){
	const reply = await linuxMediaDBus.call(new dbus.Message({
		destination,
		path,
		interface: iface,
		member,
		signature,
		body
	}))
	if (reply.type===dbus.MessageType.ERROR) {
		LOGGER.error(`Error reading media metadata from ${destination} media source: ${reply.body?.[0]}`,"MPRIS")
		return
	}
	return reply.body

}

async function getPlayerMetadata(playerId) {
	const meta = (await messageDBus(
		playerId,
		'/org/mpris/MediaPlayer2',
		PROPERTIES,
		'GetAll',
		's',
		[`${MPRIS}.Player`]
	))[0]
	let data = {
		player: playerId,
		playerName: await getMediaPlayerName(playerId),
		length: Number(meta.Metadata.value['mpris:length']?.value??0)/1000, //dividing cus its in microseconds
		album: meta.Metadata.value['xesam:album']?.value??null,
		title: meta.Metadata.value['xesam:title']?.value??null,
		artists: meta.Metadata.value['xesam:artist']?.value??[],
		cover: meta.Metadata.value['mpris:artUrl']?.value??null,
		status: meta.PlaybackStatus.value,
		position:Number(meta.Position.value??0)/1000
	}
	return data
}

async function getMediaPlayerName(playerId) {
	const identity = await messageDBus(
		playerId,
		'/org/mpris/MediaPlayer2',
		PROPERTIES,
		'Get',
		'ss',
		[MPRIS, 'Identity']
	)
	return identity[0].value
}


// #endregion


// #endregion
// #region winblows
// #endregion