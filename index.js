import { app, BrowserWindow } from 'electron'
import {startWebSocketServer} from "./src/electron/overlay-io.js"
import { GibbLogger } from './src/electron/logger.js'
import loopback from "loopback-capture"
import { fileURLToPath } from 'url'
import { CQT } from './src/electron/cqt.js'

const LOGGER = new GibbLogger("GibbMeOverlay")
const capture = new loopback.LoopbackCapture()
var WINDOW

const createWindow = () => {
	const win = new BrowserWindow({
		width: 900,
		height: 600,
		roundedCorners: false,
		webPreferences:{
			preload:fileURLToPath(new URL('./preload.js',import.meta.url))
		}
	})
	win.menuBarVisible = false
	win.loadFile('index.html')
	WINDOW = win
}

const MIN_BUF_SIZE = 512
const FFT_SIZE = 8192
const cqt = new CQT({bandsNumber:128});
/** Cyclic Buffer for audio chunk processing */
const CB = new Float32Array(cqt.requiredSamples,FFT_SIZE)
/** current CB cyclic buffer write position */
let cbWritePos    = 0
let totalSamples  = 0
let cqtAwaitedSamples	= cqt.requiredSamples

app.whenReady().then(() => {
	LOGGER.log("App init started...","MAIN")
	createWindow()
	// startWebSocketServer()
	capture.startSystemAudio(processChunk)
})

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

const FRAME_INTERVAL = 1000/144
let lastTimeProcessed = 0
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
	WINDOW.webContents.send('spectrum', spectrum)
}

app.on("before-quit",()=>{
	capture.stop()
})