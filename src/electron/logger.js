/** @namespace GibbLogger */

export let registeredLoggers = []

export class GibbLogger {

	namespace = ""
	loggerHistory = []

	constructor(namespace) {
		this.namespace = namespace
		registeredLoggers.push(this)
	}
	log(message,marker="") {
		if (message == "") return;
		this.loggerHistory.push(new Message(message, marker, getTimeString()))
		console.log(`[\x1b[32m${getTimeString()}\x1b[0m] [\x1b[1mLOG  \x1b[0m] [\x1b[1m${this.namespace}\x1b[0m${marker!=""?"/"+marker:""}] ${message}`)
	}
	error(message, marker="") {
		if (message == "") return;
		this.loggerHistory.push(new Message(message, marker, getTimeString(), "error"))
		console.log(`[\x1b[32m${getTimeString()}\x1b[0m] [\x1b[1;31mERROR\x1b[0m] [\x1b[1m${this.namespace}\x1b[0m${marker!=""?"/"+marker:""}] \x1b[31m${message}\x1b[0m`)
	}
	warn(message, marker="") {
		if (message == "") return;
		this.loggerHistory.push(new Message(message, marker, getTimeString(), "warn"))
		console.log(`[\x1b[32m${getTimeString()}\x1b[0m] [\x1b[1;33mWARN \x1b[0m] [\x1b[1m${this.namespace}\x1b[0m${marker!=""?"/"+marker:""}] \x1b[33m${message}\x1b[0m`)
	}
	clear() {
		this.loggerHistory.clear()
	}
	getHistory() {
		return this.loggerHistory
	}
}

function getTimeString() {
	let time = new Date()
	return(time.getHours().toString().padStart(2,'0')+":"+time.getMinutes().toString().padStart(2,'0')+":"+time.getSeconds().toString().padStart(2,'0')+":"+time.getMilliseconds().toString().padStart(3,'0'))
}

class Message {
	type="log"
	text = ""
	marker = ""
	timestamp = 0
	readableTime = ""
	constructor(text, marker, readableTime, type="log") {
		this.text = text
		this.marker = marker
		this.timestamp = new Date().getTime()
		this.type = type
		this.readableTime = readableTime
	}
}

export function getRegisteredLoggers() {return registeredLoggers}