const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("audio",{
	onSpectrum(callback) {
		ipcRenderer.on('spectrum',(_, spectrum)=>{
			callback(spectrum)
		})
	}
})

contextBridge.exposeInMainWorld("iconManager",{
	getIcon: (id)=>ipcRenderer.invoke('getIcon',[id])
})