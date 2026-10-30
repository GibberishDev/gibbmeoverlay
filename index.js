import { app, BrowserWindow, ipcMain, net, WebContentsView, screen } from 'electron'
import { startWebSocketServer } from "./src/electron/overlay_io.js"
import { GibbLogger } from './src/electron/logger.js'
import { fileURLToPath } from 'url'
import { TwitchAuthProvider, openTWBrowserLogin } from './src/electron/twitch_auth_manager.js'
import { registeredIcons } from './src/electron/icon_manager.js'
import { YoutubeAuthProvider, openYTBrowserLogin } from './src/electron/youtube_auth_manager.js'
import * as fs from 'fs'
import * as IconRegister from './src/registers/icons.js' 
import path from 'path'
import * as BootStrap from './src/electron/bootstrap.js'
// import { discoverPlugins } from './src/electron/plugin.js'

const LOGGER = new GibbLogger("App")
var WINDOW
var LOADING_CARD_WINDOW


const createWindow = () => {
	const win = new BrowserWindow({
		width: 900,
		height: 600,
		roundedCorners: false,
		icon:fileURLToPath(new URL('./assets/img/icon.png',import.meta.url)),
		webPreferences:{
			preload:fileURLToPath(new URL('./preload.js',import.meta.url)),
			contextIsolation:true,
			nodeIntegration:false
		}
	})
	win.hide()
	win.menuBarVisible = false
	win.loadFile('index.html')
	WINDOW = win
}

const createLoadingCard = ()=>{
	const win = new BrowserWindow({
		width: 300,
		height: 400,
		titleBarOverlay: false,
		frame: false,
		resizable: false,
		maximizable: false,
		fullscreenable: false,
		transparent: true,
		roundedCorners: false,
		webPreferences:{
			devTools:false
		}
	})
  	let position = determine_screen_with_pointer_center()
	position = {
		x: parseInt(position.x - win.getSize()[0] / 2.0),
		y: parseInt(position.y - win.getSize()[1] / 2.0)
	}
	win.setPosition(position.x, position.y)
	win.loadFile("./loading.html")
	LOADING_CARD_WINDOW = win
}


function determine_screen_with_pointer_center() {
    // get config if user wants app loaded specific way
    let pointer_location = screen.getCursorScreenPoint()
    let screen_data = screen.getDisplayNearestPoint(pointer_location)
    let screen_center = {x: screen_data.bounds.x + screen_data.bounds.width/2.0, y: screen_data.bounds.y + screen_data.bounds.height/2.0}
    return screen_center
}

/**
 * Moves session data to user's temp location and places a note in config directory about that
 */
function redirectPaths() {
	let newSessionPath = path.join(app.getPath('temp'),"gibbmeoverlay")
	if (!fs.existsSync(newSessionPath)) {
		fs.mkdirSync(newSessionPath)
	}
	app.setPath("sessionData",newSessionPath)
	if (!fs.existsSync(path.join(app.getPath('userData'),"LookingForSomething.txt"))) {
		fs.writeFile(
			path.join(app.getPath('userData'),"LookingForSomething.txt"),
			`If you are looking for session storage data I moved it to Temp location on your system.\nThere is little to no reason for average user to have it in same folder as user configs.\nIf you disagree with that decision you can change that behavior in app settings and it will take effect on next app restart\n	- GibbDev`,
			{encoding:"utf-8"},
			()=>{}
		)
	}
}

redirectPaths()

app.whenReady().then(async () => {
	createLoadingCard()
	await BootStrap.initApp(LOADING_CARD_WINDOW)
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setVer("${app.getVersion()}")`)
	LOGGER.log("App init started...","MAIN")
	IconRegister.register()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Registered ${Object.keys(registeredIcons).length} icons...")`)

	// discoverPlugins()
	authServices()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Starting Websocket...")`)
	startWebSocketServer()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Almost there...")`)
	createWindow()
})



async function authServices() {
	await TwitchAuthProvider.init()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Authenticating Twitch...")`)
	await YoutubeAuthProvider.init()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Authenticating YouTube...")`)
}

function getIconHandler(event, id) {
	return registeredIcons[id]
}

ipcMain.handle('getIcon', getIconHandler)



app.on("before-quit",()=>{
})
