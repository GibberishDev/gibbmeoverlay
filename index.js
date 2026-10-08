import { app, BrowserWindow } from 'electron'
import {startWebSocketServer} from "./src/electron/overlay-io.js"
import { GibbLogger } from './src/electron/logger.js'
import loopback from "loopback-capture"
import rfft from 'fourier-transform'
import path from 'path'
import { fileURLToPath } from 'url'

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

var sampleRate = 48000;
var fftSize = 4096;
var frameBytes = 4;

app.whenReady().then(() => {
  LOGGER.log("App init started...","MAIN")
  createWindow()
  // startWebSocketServer()
  capture.startSystemAudio(processChunk)
})
let min_db = -60;
let max_db = 0;
function getSpectrum(samples) {
  const spectrum = rfft(samples)
  const res = {}
  for (let i = 0; i<spectrum.length;i++){
    var mag = spectrum[i]
    mag = Math.max(0, mag)
    const db = 20*Math.log10(mag)

    res[Math.round(i*sampleRate/fftSize)]=Math.max(0,Math.min(1, (db-min_db)/(max_db-min_db)))
  }
  return res
}
let pending = Buffer.alloc(0)
function processChunk(chunk) {
  pending = Buffer.concat([pending,chunk])
  while (pending.length>= fftSize*frameBytes) {
    const windowBytes = pending.subarray(0,fftSize*frameBytes)
    pending = pending.subarray(fftSize*frameBytes)
    const sampleCount = Math.min(windowBytes.length / 4, fftSize)
    const left = new Float64Array(fftSize)
    const right = new Float64Array(fftSize)
    const mono = new Float64Array(fftSize)
    for (let i = 0;i<sampleCount;i++) {
      left[i]=windowBytes.readInt16LE(i*4)/32768
      right[i]=windowBytes.readInt16LE(i*4+2)/32768
      mono[i]=(left[i]+right[i])/2
    }
    // getSpectrum(mono)
    sendSpectrum(getSpectrum(mono))
  }
}

function sendSpectrum(spectrum) {
  WINDOW.webContents.send('spectrum', spectrum)
}

app.on("before-quit",()=>{
  capture.stop()
})