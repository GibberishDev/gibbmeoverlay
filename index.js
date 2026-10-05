const { app, BrowserWindow } = require('electron')

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
  createWindow()
})