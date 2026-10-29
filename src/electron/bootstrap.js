import {GibbLogger} from './logger.js'

const LOGGER = new GibbLogger("Bootstrap")
let LW = undefined

export async function initApp(LoadingWindow=undefined) {
	if (LoadingWindow) LW = LoadingWindow
	setText("App init started...")
	LOGGER.log("Started app bootstrap")
	await initRegisters()
	return
}

async function initRegisters() {
	LOGGER.log("Registering icons")
	setText("Registering icons...")
}

function setText(text) {
	if (!LW) return
	LW.webContents.executeJavaScript(`setText("${text}")`)
}