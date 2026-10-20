import { app } from 'electron'
import *as fs from'fs'
import path from 'path'
import {GibbLogger} from './logger.js'

const LOGGER = new GibbLogger("PLUGINS")

export class PluginsManager {

	pluginsPath = path.join(app.getPath('userData'),'plugins')
	registeredPlugins={}

	constructor(){}

	async discoverPlugins() {
		if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath)
		let subfolders = fs.readdirSync(pluginsPath)
		let uncheckedPlugins = {}
		for (let folder of subfolders) {
			let folderPath = path.join(pluginsPath, folder)
			if (!fs.lstatSync(folderPath).isDirectory()) continue
			if (!fs.existsSync(path.join(folderPath, 'manifest.json'))) continue
			let pluginData = await JSON.parse(fs.readFileSync(path.join(folderPath, 'manifest.json')))
			uncheckedPlugins[folder] = pluginData
		}
		this.validatePlugins(uncheckedPlugins)
	}

	async validatePlugins(uncheckedPlugins) {
		for (let folder of Object.keys(uncheckedPlugins)) {
			const rootPath = path.join(this.pluginsPath, folder)
			const data = uncheckedPlugins[folder]
		}
	}
}

class GMOPlugin {
	id=""
	constructor(id, pluginPermissions={}, settings={}){

	}
}


// TODO: move to global utils probably
Array.prototype.hasAll=function(arrayLike){
	if (!Array.isArray(arrayLike)) arrayLike = [arrayLike]
	for (let val of arrayLike) {
		if (!this.includes(val)) return false
	}
	return true
}