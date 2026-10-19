import { StaticAuthProvider } from '@twurple/auth'
import { GibbLogger } from './logger.js'
import { app, safeStorage, session, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ApiClient } from '@twurple/api'

const LOGGER = new GibbLogger("Twitch")
const TW_OAUTH_URL = "https://id.twitch.tv/oauth2/"


class TwitchAuth {
	clientID = "gxx65s9oinob982866o38ipol8izd8"
	tokenPath = path.join(
		app.getPath('appData'),
		'gibbmeoverlay','tw-tokens.enc'
	)
	streamerAccount = null
	botAccount = null

	async init() {
		this.streamerAccount = new StreamerAccount(this.clientID)
		this.botAccount = new BotAccount(this.clientID)
		LOGGER.log('Authenticating twitch accounts...','Auth')
		let tokenData = await this.loadTokens()
		if (tokenData == null || Object.keys(tokenData).length==0) {
			LOGGER.log("No token data. Aborting authentication","Auth")
			return false
		}
		if (tokenData?.streamer) {
			this.streamerAccount.setTokens(tokenData.streamer)
			let success = await this.streamerAccount.init()
			if (!success) LOGGER.error("Streamer account authentication failed. Awaiting user action","Auth")
		}
		if (tokenData?.bot) {
			this.botAccount.setTokens(tokenData.bot)
			let success = await this.botAccount.init()
			if (!success) LOGGER.error("Bot account authentication failed. Awaiting user action","Auth")
		}
		this.saveTokens()
		return true
	}

	async saveTokens() {
		let tokens = {}
		if (this.streamerAccount.authenticated) tokens.streamer=this.streamerAccount.tokenData
		if (this.botAccount.authenticated) tokens.bot = this.botAccount.tokenData
		await fs.mkdir(path.dirname(this.tokenPath), {recursive: true})
		const encrypted = safeStorage.encryptString(JSON.stringify(tokens))
		await fs.writeFile(this.tokenPath, encrypted)
	}
	async loadTokens() {
		try {
			const encrypted = await fs.readFile(this.tokenPath)
			LOGGER.log(`Loaded twitch auth tokens`, "Auth")
			return JSON.parse(safeStorage.decryptString(encrypted))
		} catch(err) {
			if (err.code==='ENOENT') {return null}
			LOGGER.error(`Error loading saved tokens from disk. ${err}`,"Auth")
			return null
		}
	}
	async authorizeStreamer(onDeviceInfo=(deviceCode, url)=>{}) {
		if (await this.streamerAccount.authorizeDevice(onDeviceInfo)) this.saveTokens()
		if (twLoginWindow) twLoginWindow.close()
	}
	async authorizeBot(onDeviceInfo=(deviceCode, url)=>{}) {
		if (await this.botAccount.authorizeDevice(onDeviceInfo)) this.saveTokens()
		if (twLoginWindow) twLoginWindow.close()
	}

}

class CommonAccount {
	clientID=""
	type=""
	scopes = []
	authenticated = false
	api = null
	tokenData={
		accessToken: null,
		refreshToken: null, 
		expires: 0, // timestamp in ms
	}
	refreshInProgress=false
	refreshTimeoutReference=null

	constructor(clientID, tokenData=null) {
		if (clientID) {} else {
			LOGGER.error("No client ID specified for application","Auth")
			return null
		}
		this.clientID = clientID
		if (tokenData) {
			this.setTokens(tokenData)
		}
		return this
	}

	async init() {
		if (!await this.isTokenValid()) {
			if (!await this.refreshTokens()) {
				LOGGER.error(`Error occured while refreshing tokens for ${this.type} account`, "Auth")
				return false
			}
		}
		this.updateAPI()
		return true
	}

	updateAPI() {
		this.api = new ApiClient({authProvider: new StaticAuthProvider(
			this.clientID,
			this.tokenData.accessToken,
			this.scopes
		)})
		this.authenticated=true
		LOGGER.log(`${this.type} account api updated`,"Auth")
		if (this.refreshTimeoutReference) clearTimeout(this.refreshTimeoutReference)
		this.refreshTimeoutReference = setTimeout(async ()=>{
			if (!await this.isTokenValid()) {
				this.refreshTokens()
			}
			LOGGER.log(`${this.type} account token is valid`, "Auth")
			if (this.tokenData.expires < Date.now() + 15*60*1000) { 
				LOGGER.log(`${this.type} account token expires in <15 minutes. Refreshing`, "Auth")
				this.refreshTokens()
			}
		},15*60*1000)
	}

	setTokens(tokenData) {
		if (tokenData?.accessToken) this.tokenData.accessToken = tokenData.accessToken
		if (tokenData?.refreshToken) this.tokenData.refreshToken = tokenData.refreshToken
		if (tokenData?.expires) this.tokenData.expires = tokenData.expires
	}

	async isTokenValid() {
		LOGGER.log(`Validating tokens for ${this.type} account...`,"Auth")
		if (this.tokenData.expires<Date.now()) {
			LOGGER.warn(`${this.type} account token expired`,"Auth")
			this.authenticated = false
 			return false
		}
		const resp = await fetch(
			TW_OAUTH_URL+'validate',
			{headers:{Authorization:`OAuth ${this.tokenData.accessToken}`}}
		)
		if (!resp.ok) {
			LOGGER.warn(`${this.type} account token invalid`,"Auth")
			this.authenticated = false
			return false
		}
		return true

	}

	async refreshTokens() {
		LOGGER.log(`Refreshing token for ${this.type} account`,"Auth")
		const res = await this.postForm(
			TW_OAUTH_URL+'token',
			{
				client_id: this.clientID,
				grant_type: 'refresh_token',
				refresh_token: this.tokenData.refreshToken
			}
		)
		if (res) {
			this.tokenData={
				accessToken: res.access_token,
				refreshToken: res.refresh_token,
				expires: Date.now()+res.expires_in*1000,
				scopes:res.scopes
			}
			return true
		} else {
			return false
		}
	}

	async postForm(url, fields) {
		const resp = await fetch(url,{
			method:'POST',
			headers:{'Content-Type':'application/x-www-form-urlencoded'},
			body:new URLSearchParams(fields)
		})
		const data = await resp.json()
		if (!resp.ok) {
			if (data?.message == "authorization_pending") {
				return null
			}
			else {
				LOGGER.error(`Twitch fetch request failed with status: ${resp.status} - ${data.message}`, "Auth")
				return null
			}
		}
		return data
	}

	async authorizeDevice(onDeviceInfo=(code, url)=>{}) {
		LOGGER.log(`Authorizing new ${this.type} account...`, "Auth")
		const device = await this.postForm(
			TW_OAUTH_URL+'device',
			{
				client_id: this.clientID,
				scopes: this.scopes.join(' ')
			}
		)
		onDeviceInfo(
			device.user_code,
			device.verification_uri
		)
		const deadline = Date.now()+device.expires_in*1000
		let interval=device.interval
		while (Date.now()<deadline) {
			await new Promise(res=>setTimeout(res,interval*1000))
			try {
				const res = await this.postForm(
					TW_OAUTH_URL+'token',
					{
						client_id: this.clientID,
						device_code: device.device_code,
						grant_type:'urn:ietf:params:oauth:grant-type:device_code'
					}
				)
				this.tokenData.accessToken= res.access_token
				this.tokenData.refreshToken= res.refresh_token
				this.tokenData.expires = Date.now()+res.expires_in*1000
				this.authenticated = true
				LOGGER.log(`Authenticated ${this.type} account successfully`,"Auth")
				return true
			} catch (err) {
				if (err.message){
					if (err.message==='authorization_pending') continue
					if (err.message==='slow_down') {
						interval+=5
						continue
					}
				} else {
					LOGGER.error(`Error while authenticating ${this.type} device: ${err?.message}`,"Auth")
					return false
				}
			}
		}
		LOGGER.error(`Twitch ${this.type} account authorization expired`,'Auth')
		return false

	}
}

class StreamerAccount extends CommonAccount {
	constructor(clientID, tokenData=null) {
		super(clientID, tokenData)
		this.type = "STREAMER"
		this.scopes = [
			"bits:read",
			"channel:edit:commercial",
			"channel:manage:ads",
			"channel:manage:broadcast",
			"channel:manage:moderators",
			"channel:manage:polls",
			"channel:manage:predictions",
			"channel:manage:raids",
			"channel:manage:redemptions",
			"channel:manage:schedule",
			"channel:manage:videos",
			"channel:manage:vips",
			"channel:moderate",
			"channel:read:ads",
			"channel:read:charity",
			"channel:read:editors",
			"channel:read:goals",
			"channel:read:hype_train",
			"channel:read:polls",
			"channel:read:predictions",
			"channel:read:redemptions",
			"channel:read:stream_key",
			"channel:read:subscriptions",
			"channel:read:vips",
			"chat:edit",
			"chat:read",
			"clips:edit",
			"moderation:read",
			"moderator:manage:announcements",
			"moderator:manage:automod",
			"moderator:manage:automod_settings",
			"moderator:manage:banned_users",
			"moderator:manage:blocked_terms",
			"moderator:manage:chat_messages",
			"moderator:manage:chat_settings",
			"moderator:manage:shield_mode",
			"moderator:manage:shoutouts",
			"moderator:manage:unban_requests",
			"moderator:manage:warnings",
			"moderator:read:automod_settings",
			"moderator:read:banned_users",
			"moderator:read:blocked_terms",
			"moderator:read:chat_messages",
			"moderator:read:chat_settings",
			"moderator:read:chatters",
			"moderator:read:followers",
			"moderator:read:moderators",
			"moderator:read:shield_mode",
			"moderator:read:shoutouts",
			"moderator:read:unban_requests",
			"moderator:read:vips",
			"moderator:read:warnings",
			"user:edit:broadcast",
			"user:manage:blocked_users",
			"user:manage:whispers",
			"user:read:blocked_users",
			"user:read:broadcast",
			"user:read:chat",
			"user:read:emotes",
			"user:read:follows",
			"user:read:subscriptions",
			"user:write:chat",
			"whispers:edit",
			"whispers:read"
		]
	}
}

class BotAccount extends CommonAccount {
	constructor(clientID, tokenData=null) {
		super(clientID, tokenData)
		this.type = "BOT"
		this.scopes = [
            "channel:moderate",
            "chat:edit",
            "chat:read",
            "moderator:manage:announcements",
            "moderator:manage:banned_users",
            "moderator:manage:chat_messages",
            "moderator:manage:chat_settings",
            "moderator:manage:shield_mode",
            "moderator:manage:shoutouts",
            "moderator:manage:warnings",
            "user:manage:whispers",
            "user:read:chat",
            "user:read:emotes",
            "user:write:chat",
            "whispers:edit",
            "whispers:read"
		]
	}
}


var twLoginWindow = null
var twSession = null

export async function openTWBrowserLogin(url) {
	twSession = session.fromPartition(`tw-login-${Date.now()}`)
	twLoginWindow = new BrowserWindow({
		width:650,
		height:650,
		roundedCorners: false,
		resizable: false,
		webPreferences: {
			session: twSession
		}
	})
	twLoginWindow.menuBarVisible = false
	await twLoginWindow.loadURL(url)
	twLoginWindow.on("closed", ()=>{
		twSession.clearData()
		twLoginWindow = null
	})
}


export const TwitchAuthProvider = new TwitchAuth()