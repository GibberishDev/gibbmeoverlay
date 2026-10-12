import { RefreshingAuthProvider, StaticAuthProvider } from '@twurple/auth'
import { GibbLogger } from './logger.js'
import { app, safeStorage, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ApiClient } from '@twurple/api'


const LOGGER = new GibbLogger("Twitch")

export class TwitchAuthManager {
	botAPI=null
	streamerAPI=null
	authenticated={
		bot:false,
		streamer:false
	}
	clientId = "gxx65s9oinob982866o38ipol8izd8"
	scopes = {
		streamer: [
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
        ],
		bot: [
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
	tokens = {
		streamer:{},
		bot:{}
	}
	tokenPath = path.join(
		app.getPath('appData'),
		'twitch-tokens.enc'
	)



	async init() {
		LOGGER.log("Authenticating twitch accounts...","Auth")
		await this.getTokens()
		if (!this.tokens.streamer?.accessToken||!this.tokens.streamer?.refreshToken) {
			LOGGER.warn("Loaded tokens for streamer are invalid: missing accessToken or refreshToken","Auth")
		} else {
			const resp = await fetch(
				'https://id.twitch.tv/oauth2/validate',
				{headers:{Authorization:`OAuth ${this.tokens.streamer.accessToken}`}}
			)
			if (resp.status === 401) {
				LOGGER.error("Loaded access token for streamer account is invalid","Auth")
			} else if (!resp.ok) {
				LOGGER.error(`Twitch validation request failed with status code: ${resp.status}`,"Auth")
			} else {
				let data = await resp.json()
				this.createStreamerAPI()
				this.authenticated.streamer=true
				LOGGER.log("Authenticated streamer account successfully","Auth")
			}


		}
		if (Object.keys(this.tokens.bot).includes()) {
			
		}
		//TODO: add a loop to refresh access token every half an hour or so 
	}



	async saveTokens() {
		if (this.tokens) {
			const encrypted = safeStorage.encryptString(
				JSON.stringify(this.tokens)
			)
			await fs.writeFile(this.tokenPath, encrypted)
		}
	}
	async getTokens() {
		try {
			const encrypted = await fs.readFile(this.tokenPath)
			this.tokens = JSON.parse(safeStorage.decryptString(encrypted))
			LOGGER.log(`Loaded twitch auth tokens`, "Auth")
		} catch(err) {
			LOGGER.error(`Error loading saved tokens from disk. ${err}`,"Auth")
		}
	}
	createStreamerAPI() {
		this.streamerAPI = new ApiClient({authProvider: new StaticAuthProvider(
			this.clientId,
			this.tokens.streamer.accessToken,
			this.scopes.streamer
		)})
	}

	async postForm(url, fields) {
		const resp = await fetch(url,{
			method:'POST',
			headers:{'Content-Type':'application/x-www-form-urlencoded'},
			body:new URLSearchParams(fields)
		})
		const data = await resp.json()
		if (!resp.ok) throw new Error(data.message||`Twitch auth request failed`, 'Auth')
		return data
	}

	async loginStreamer(onStatus=()=>{}) {
		const device = await this.postForm(
			'https://id.twitch.tv/oauth2/device',
			{
				client_id: this.clientId,
				scopes: this.scopes.streamer.join(' ')
			}
		)
		console.log(device.verification_uri)
		onStatus({
			userCode:device.user_code,
			verificationUri: device.verification_uri
		})

		await shell.openExternal(device.verification_uri)
		const deadline = Date.now()+device.expires_in*1000
		let interval=device.interval
		while (Date.now()<deadline) {
			await new Promise(res=>setTimeout(res,interval*1000))
			try {
				const res = await this.postForm(
					'https://id.twitch.tv/oauth2/token',
					{
						client_id: this.clientId,
						device_code: device.device_code,
						grant_type:'urn:ietf:params:oauth:grant-type:device_code'
					}
				)
				this.tokens.streamer = {
					accessToken: res.access_token,
					refreshToken: res.refresh_token,
					expiresAt: Date.now()+res.expires_in*1000,
					scopes:res.scopes
				}
				await this.saveTokens()
				this.createStreamerAPI()
				return await this.getStreamerTwitchUser()
			} catch (err) {
				if (err.message){
					if (err.message==='authorization_pending') continue
					if (err.message==='slow_down') {
						interval+=5
						continue;
					}
				}
				throw err
			}
		}
		LOGGER.error('Twitch authorization expired','Auth')
		return
	}

	async refreshStreamerTokens() {
		const res = await this.postForm(
			'https://id.twitch.tv/oauth2/token',
			{
				client_id: this.clientId,
				grant_type: 'refresh_token',
				refresh_token: this.tokens.streamer.refreshToken
			}
		)
		this.tokens.streamer={
			accessToken: res.access_token,
			refreshToken: res.refresh_token,
			expiresAt: Date.now()+res.expires_in*1000,
			scopes:res.scopes
		}
		this.createStreamerAPI()
	}

	async getStreamerTwitchUser() {
		if (!this.streamerAPI) {LOGGER.error("Streamer account is not authenticated",'Auth');return null}

		const resp = await fetch(
			'https://id.twitch.tv/oauth2/validate',
			{headers:{Authorization:`OAuth ${this.tokens.streamer.accessToken}`}}
		)
		if (!resp.ok) {LOGGER.error('Twitch token is invalid or expired','Auth');return null}

		const validation = await resp.json()
		this.createStreamerAPI()
		const user = await this.streamerAPI.users.getAuthenticatedUser(validation.user_id)
		return user
	}
	
	async refreshTokens() {
		if (!this.tokens.streamer?.refreshToken) {LOGGER.error("No refresh token for streamer account","Auth")}
		else {
			const resp = await fetch(
				'https://id.twitch.tv/oauth2/token',
				{
					method:"POST",
					headers:{'Content-Type':'application/x-www-form-urlencoded'},
					body: new URLSearchParams({
						client_id: this.clientId,
						grant_type:'refresh_token',
						refresh_token:this.tokens.streamer.refreshToken
					})
				}
			)
			if (!resp.ok) {
				if (resp.status === 400||resp.status===401) {
					LOGGER.error('Refresh token for streamer account rejected','Auth')
				} else {
					LOGGER.error(`Token refresh failed with status code: ${resp.status}`,"Auth")
				}
			} else {
				const data = await resp.json()
				this.tokens.streamer = {
					accessToken:	data.access_token,
					refreshToken:	data.refresh_token,
					expiresAt:		Date.now()+data.expires_in*1000,
					scopes:			data.scopes
				}
				this.saveTokens()
				this.createStreamerAPI()
			}
		}
	}

}