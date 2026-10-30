
import loopback from "loopback-capture";
import { execFile } from "node:child_process"


export class UserAudioManager {
}

export class PIDAudioListener {
	PID = 0
	listening = false
	LC=null

	constructor(){
		this.LC = new loopback.LoopbackCapture()
	}

	// setProcess(PID) {
	// 	this.PID = PID
	// 	if (this.listening) {
	// 		this.stopListening()
	// 		this.startListening()
	// 	}
	// }


	startListening() {
		this.listening = true
		this.LC.start()
	}
	stopListening() {

	}

}

/**
 * @dist OnlyIn: linux
 * NOT USED ATM as loopback-capture and (a lot other) other packages are not up to my quality standards to roll out per process capture for linux
 */
export function getPIDInfo() {
	return new Promise((res, rej)=>{
		let crawledPIDs = []
		let output = []
		execFile("pw-dump",[],(err,stdout)=>{
			if(err){rej(err);return}
			try {
				const pwDumpObject = JSON.parse(stdout)
				for (let pidInfoObject of pwDumpObject) {
					if (pidInfoObject.type=="PipeWire:Interface:Node" && pidInfoObject.info?.props?.["media.class"]=="Stream/Output/Audio") {
						if (pidInfoObject.info.props["application.process.binary"] && !crawledPIDs.includes(pidInfoObject.info.props["application.process.id"])) {
							output.push({
								binary:pidInfoObject.info.props["application.process.binary"],
								pid : pidInfoObject.info.props["application.process.id"]
							})
							crawledPIDs.push(pidInfoObject.info.props["application.process.id"])
						}
					}
				}
				res(output)
			} catch (err) {rej(err)}
		})
	})
}