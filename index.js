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
var fftSize = 2048;
var frameBytes = 4;
let min_freq = 40
let max_freq = 20000
var bandCount = 64

app.whenReady().then(() => {
  LOGGER.log("App init started...","MAIN")
  createWindow()
  // startWebSocketServer()
  capture.startSystemAudio(processChunk)
})

function getSpectrum(samples) {
  const spectrum = rfft(samples)
  const res = {}
  const binWidth = sampleRate/fftSize
  var bands = []
  const highResBands = []
  const lowResBands = []
  var str = ""
  for (let band = 0; band<bandCount;band++) {
    let bandLF = min_freq*Math.pow(max_freq/min_freq,band/bandCount)
    let bandHF = min_freq*Math.pow(max_freq/min_freq,(band+1)/bandCount)
    if ((bandHF-bandLF)<binWidth) {
      highResBands.push({
        lf:bandLF,
        hf:bandHF,
        sum:0,
        count:0,
        color:"teal",
        actual_freq:0
      })
    } else {
      lowResBands.push({
        lf:bandLF,
        hf:bandHF,
        sum:0,
        count:0,
        color:"red"
      })
    }
  }
  console.clear()
  for (let bin=1;bin<spectrum.length;bin++){
    let freq = bin*binWidth
    if ((bin- 1) < highResBands.length) {
      highResBands[bin - 1].sum = spectrum[bin]**2
      highResBands[bin - 1].count = 1
      highResBands[bin - 1].actual_freq = freq
    } else {
      let bandID = Math.floor(Math.log(freq/min_freq)/Math.log(max_freq/min_freq)*bandCount)-highResBands.length
      if (bandID<0||bandID>=(lowResBands.length))continue
      lowResBands[bandID].sum += spectrum[bin]**2
      lowResBands[bandID].count++
    }
  }
  bands = highResBands.concat(lowResBands)

  for (let band of bands) {
    let mf = Math.max(1,Math.sqrt(band.lf*band.hf))
    const mag = band.count>0?Math.sqrt(band.sum/band.count):0
    const normMag = mag * Math.pow(mf/1000,0.5)
    if (normMag>0) res[Math.round(Math.sqrt(band.lf*band.hf))]={val:normMag,color:band.color, lf:band.lf, hf:band.hf, af:band.actual_freq}
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