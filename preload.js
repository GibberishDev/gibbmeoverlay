const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("audio",{
	onSpectrum(callback) {
		ipcRenderer.on('spectrum',(_, spectrum)=>{
			callback(spectrum)
		})
	}
})