import { Notification } from "electron";
import { fileURLToPath } from 'url'

export function sendSystemNotification() {
	new Notification({
		icon: fileURLToPath(new URL('../../assets/img/icon.png',import.meta.url)),
		title: "Test",
		body: "Test body",
	}).show()
}