
import { app, safeStorage, session } from 'electron'
import { Innertube } from 'youtubei.js'
import { GibbLogger } from './logger.js'
import fs from 'node:fs/promises'
import path from 'node:path'

const LOGGER = new GibbLogger('YouTube')

class YoutubeAuth {
	tokenPath = path.join(
		app.getPath('appData'),
		'gibbmeoverlay',
		'yt-tokens.enc'
	)
	streamerAccount = null
	botAccount = null

	async init() {
		this.streamerAccount = new YoutubeAccount('STREAMER')
		this.botAccount = new YoutubeAccount('BOT')
		LOGGER.log(`Authenticating youtube accounts...`,"Auth")
		let tokenData = await this.loadTokens()
		if (tokenData == null || Object.keys(tokenData).length==0) {
			LOGGER.log("No token data. Aborting authentication","Auth")
			return false
		}
		if (tokenData.streamer?.token) await this.authorizeStreamer(tokenData.streamer.token)
		if (tokenData.bot?.token) await this.authorizeStreamer(tokenData.streamer.token)
		await this.saveTokens()
	}

	async authorizeStreamer(token) {
		this.streamerAccount.setToken(token)
		let result = await this.streamerAccount.init()
		if (result) this.saveTokens()
		return result
	}
	async authorizeBot(token) {
		this.botAccount.setToken(token)
		let result = await this.botAccount.init()
		if (result) this.saveTokens()
		return result
	}
	async saveTokens() {
		const tokens = {}
		if (this.streamerAccount?.authenticated) tokens.streamer = {token: this.streamerAccount.token}
		if (this.botAccount?.authenticated) tokens.bot = {token: this.botAccount.token}
		await fs.mkdir(path.dirname(this.tokenPath), {recursive: true})
		const encrypted = safeStorage.encryptString(JSON.stringify(tokens))
		await fs.writeFile(this.tokenPath, encrypted)
	}
	async loadTokens() {
		try {
			const encrypted = await fs.readFile(this.tokenPath)
			LOGGER.log(`Loaded youtube auth tokens`, "Auth")
			return JSON.parse(safeStorage.decryptString(encrypted))
		} catch(err) {
			if (err.code==='ENOENT') {return null}
			LOGGER.error(`Error loading saved tokens from disk. ${err}`,"Auth")
			return null
		}
	}
}

class YoutubeAccount {
	type
	token = null
	yt = null
	authenticated = false

	constructor(type) {
		this.type = type
	}

	setToken(token) {
		this.token = token
	}

	async init() {
		this.authenticated = false
		this.yt = null
		const yt = await Innertube.create({ cookie:this.token })
		try {
			await yt.account.getInfo()
			this.yt = yt
			this.authenticated = true
			LOGGER.log(`Authenticated ${this.type} account successfully`,"Auth")
			return true
		} catch (err) {
			LOGGER.error(`Error while authenticating ${this.type} account: ${err?.message}`,"Auth")
			return false
		}
	}

	async logout() {
		this.cookie = null
		this.yt = null
		this.authenticated = false
	}
}

class YoutubeStreamerAccount extends YoutubeAccount {
	constructor() {
		super("STREAMER")
	}
}
class YoutubeBotAccount extends YoutubeAccount {
	constructor() {
		super("BOT")
	}
}


export const YoutubeAuthProvider = new YoutubeAuth()