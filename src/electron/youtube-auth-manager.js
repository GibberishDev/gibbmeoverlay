
import { app, safeStorage, BrowserWindow, session } from 'electron'
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
		this.streamerAccount = new YoutubeStreamerAccount()
		this.botAccount = new YoutubeBotAccount()
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
		this.saveTokens()
		return result
	}
	async authorizeBot(token) {
		this.botAccount.setToken(token)
		let result = await this.botAccount.init()
		this.saveTokens()
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
		try {
			this.yt = await Innertube.create({ cookie:this.token })
		} catch (err) {
			LOGGER.error(`Error while authenticating ${this.type} account: invalid token. Authenticate again: ${err}`,"Auth")
			this.token = ""
			return false
		}
		try {
			await this.yt.account.getInfo()
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

var ytLoginWindow = null
var ytSession = null

export async function openYTBrowserLogin(account) {
	ytSession = session.fromPartition(`yt-login-${Date.now()}`)
	ytLoginWindow = new BrowserWindow({
		width:650,
		height:650,
		roundedCorners: false,
		resizable: false,
		webPreferences: {
			session: ytSession
		}
	})
	ytLoginWindow.menuBarVisible = false
	await ytLoginWindow.loadURL("https://accounts.google.com/v3/signin/identifier?continue=https://www.youtube.com/signin?action_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3Dhttps%3A%2F%2Fwww.youtube.com%2F%3FthemeRefresh%3D1&ec=65620&hl=en&passive=true&service=youtube&uilel=3&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S621133160:1792354616533790")
	ytLoginWindow.webContents.on('did-navigate', (ev, url)=>{handleYTLogInUrlChange(url, account)})
	ytLoginWindow.on("closed", ()=>{ytSession.clearData()})
}

async function handleYTLogInUrlChange(url, account) {
	if (url.startsWith("https://www.youtube.com/")) {
		const cookiesAcc = await ytSession.cookies.get({
			domain:'accounts.youtube.com'
		})
		const cookiesRegular = await ytSession.cookies.get({
			domain:'youtube.com'
		})
		let cookies = {}
		for (let cookieOBJ of cookiesAcc) {
			cookies[cookieOBJ.name] = cookieOBJ.value
		}
		for (let cookieOBJ of cookiesRegular) {
			cookies[cookieOBJ.name] = cookieOBJ.value
		}
		let tkn = []
		for (let key of Object.keys(cookies)) {
			tkn.push(`${key}=${cookies[key]}`)
		}
		let output = tkn.join("; ")
		ytLoginWindow.close()
		account.setToken(output)
		account.init()
		return
	}
}

export const YoutubeAuthProvider = new YoutubeAuth()