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
  wss = new WS.Server({
    host: "127.0.0.1",
    port: 10302
  })
  wss.on("connection",(ws)=>{
    webSocket = ws
    ws.on("message", (data)=>{
      handleWebsocket(data)
    })
  })
  server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin","*")
    if (req.url==="/api/state") {
      res.writeHead(200, {"content-type":"text/json; charset=utf-8"})
      res.end(JSON.stringify({
        status: "on"
      }))
    }
  })
  server.listen(10301, "127.0.0.1")
})

function handleWebsocket(data) {
  console.log("Websocket message received")
  data = JSON.parse(data.toString())
  if (data.type) {
    switch (data.type) {
      case "HANDSHAKE": {
        console.log("Overlay connected event")
        wss.clients.forEach((client) => {
          client.send(JSON.stringify({
            type: "HANDSHAKE",
            message: "complete"
          }))
        })
      }
    }
  }
}