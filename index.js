import { app, BrowserWindow, ipcMain, net, WebContentsView, screen } from 'electron'
import { startWebSocketServer } from "./src/electron/overlay-io.js"
import { GibbLogger } from './src/electron/logger.js'
import { fileURLToPath } from 'url'
import { TwitchAuthProvider, openTWBrowserLogin } from './src/electron/twitch-auth-manager.js'
import { registeredIcons } from './src/electron/icon_manager.js'
import { YoutubeAuthProvider, openYTBrowserLogin } from './src/electron/youtube-auth-manager.js'
import * as fs from 'fs'
import { MediaInfoInterface } from './src/electron/media-info.js'
import * as IconRegister from './src/registers/icons.js' 
import path from 'path'
// import { discoverPlugins } from './src/electron/plugin.js'




// import { sendSystemNotification } from './src/electron/notification.js'
import loopback from "loopback-capture"
import { CQT } from './src/electron/cqt.js'
import { getPIDInfo } from './src/electron/user-audio-manager.js'

const LOGGER = new GibbLogger("App")
const capture = new loopback.LoopbackCapture()
var WINDOW
var LOADING_CARD_WINDOW
var ytWin
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

app.whenReady().then(() => {
	createLoadingCard()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setVer(${app.getVersion()})`)
	LOADING_CARD_WINDOW.webContents.executeJavaScript("setText(\"App init started...\")")
	LOGGER.log("App init started...","MAIN")
	IconRegister.register()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Registered ${Object.keys(registeredIcons).length} icons...")`)

	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Registered ${Object.keys(registeredIcons).length} icons...")`)
	// discoverPlugins()
	authServices()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Starting Websocket...")`)
	startWebSocketServer()
	LOADING_CARD_WINDOW.webContents.executeJavaScript(`setText("Almost there...")`)
	createWindow()
})


function float32ToInt16PCM(floatBuffer) {
  if (floatBuffer.length % 4 !== 0) {
    throw new Error("Buffer length must be divisible by 4");
  }
  const sampleCount = floatBuffer.length / 4;
  const pcm16 = Buffer.allocUnsafe(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    let sample = floatBuffer.readFloatLE(i * 4);
    sample = Math.max(-1, Math.min(1, sample));
    const int16 = sample < 0
      ? Math.round(sample * 32768)
      : Math.round(sample * 32767);
    pcm16.writeInt16LE(int16, i * 2);
  }
  return pcm16;
}


async function getMediaInfo() {
	let mii = new MediaInfoInterface()
	mii.getPlayingMedia().then((info)=>{console.log(info)})
}

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

// #region audio spectrum
const MIN_BUF_SIZE = 512
const FFT_SIZE = 8192
const cqt = new CQT({bandsNumber:128});
/** Cyclic Buffer for audio chunk processing */
const CB = new Float32Array(cqt.requiredSamples,FFT_SIZE)
/** current CB cyclic buffer write position */
let cbWritePos    = 0
let totalSamples  = 0
let cqtAwaitedSamples	= cqt.requiredSamples
const FRAME_INTERVAL = 1000/144
let lastTimeProcessed = 0

function processChunk(chunk) {
	/** Bytes per chunk frame. for 16bit interleaved stream its 16bit left+ 16bit right for total of 4 bytes*/
	const BPF   = 4
	const BYTES = chunk.length-(chunk.length%BPF)

	for (let offset=0;offset<BYTES;offset+=BPF) {
		const left  =chunk.readInt16LE(offset)/32768
		const right =chunk.readInt16LE(offset)/32768
		const mono  =(left+right)/2.0

		CB[cbWritePos]=mono
		cbWritePos = (cbWritePos+1)%cqt.requiredSamples
		totalSamples++

		if (totalSamples>=cqt.requiredSamples) {
			cqtAwaitedSamples--
			if (cqtAwaitedSamples<=0) {
				cqtAwaitedSamples = MIN_BUF_SIZE
				processSamples()
			}
		}
	}
}
function processSamples() {
	if (performance.now() - lastTimeProcessed >= FRAME_INTERVAL) {
		lastTimeProcessed = performance.now()
		const samples = getOrderedSamples()
		const magnitudes = Array.from(cqt.process(samples))
		const spectrum = {
			freq: Array.from(cqt.getFrequencies()),
			mag: magnitudes,
			db: getDecibels(magnitudes),
			nm: getNormalizedMagnitudes(magnitudes),
			ndb: getDecibels(getNormalizedMagnitudes(magnitudes))
		}
		sendSpectrum(spectrum)
		
	}
}
function getDecibels(mags) {
	let db = []
	for (let mag of mags) db.push(Math.max(0,Math.min(1, ((20*Math.log10(Math.max(mag,1e-8)))+80)/80)))
	return db
}
function getNormalizedMagnitudes(mags) {
	let nm = []
	for (let mag of mags) nm.push(mag * Math.pow(20000/1000,0.9))
	return nm
}
function getOrderedSamples() {
	const ordered = new Float32Array(cqt.requiredSamples)
	const cyclicBufferStart = cqt.requiredSamples - cbWritePos

	ordered.set(CB.subarray(cbWritePos),0)
	ordered.set(CB.subarray(0,cbWritePos), cyclicBufferStart)

	return ordered
}
function sendSpectrum(spectrum) {
	console.log(spectrum)
	// WINDOW.webContents.send('spectrum', spectrum)
}
// #endregion