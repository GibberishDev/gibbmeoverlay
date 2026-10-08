import { app, BrowserWindow } from 'electron'
import {startWebSocketServer} from "./src/scripts/overlay-io.js"
import { GibbLogger } from './src/scripts/logger.js'

const LOGGER = new GibbLogger("GibbMeOverlay")

const createWindow = () => {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    roundedCorners: false
  })
  win.menuBarVisible = false
  win.loadFile('index.html')
}

app.whenReady().then(() => {
  LOGGER.log("App init started...","MAIN")
  LOGGER.warn("test warning","MAIN")
  LOGGER.error("test error","MAIN")
  createWindow()
  startWebSocketServer()
})