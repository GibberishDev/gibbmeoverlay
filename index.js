import { app, BrowserWindow } from 'electron'
import {startWebSocketServer} from "./src/electron/overlay-io.js"
import { GibbLogger } from './src/electron/logger.js'
import loopback from "loopback-capture"
import { fileURLToPath } from 'url'
import { createCQT } from './src/electron/cqt.js'

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
const CQT = createCQT({binsPerOctave:127/Math.log2(20000/40)});
/** Cyclic Buffer for audio chunk processing */
const CB = new Float32Array(CQT.requiredSamples,FFT_SIZE)
/** current CB cyclic buffer write position */
let cbWritePos    = 0
let totalSamples  = 0
let cqtAwaitedSamples	= CQT.requiredSamples

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
		cbWritePos = (cbWritePos+1)%CQT.requiredSamples
		totalSamples++

		if (totalSamples>=CQT.requiredSamples) {
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
		const magnitudes = Array.from(CQT.process(samples))
		const db = getDecibels(magnitudes)
		const normMag = getNormalizedMagnitudes(magnitudes)
		const spectrum = {
			freq: Array.from(CQT.frequencies),
			magnitudes: magnitudes,
			db: db,
			nm: normMag
		}
		sendSpectrum(spectrum)
	}
}


function getDecibels(mags) {
	let db = []
	for (mag of mags) db.push(20*Math.log10(mag))
	return db
}
function getNormalizedMagnitudes(mags) {
	let nm = []
	for (mag of mags) nm.push(mag * Math.pow(20000/1000,0.5))
	return nm
}


function getOrderedSamples() {
	const ordered = new Float32Array(CQT.requiredSamples)
	const cyclicBufferStart = CQT.requiredSamples - cbWritePos

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