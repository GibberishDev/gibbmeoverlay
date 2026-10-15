import { Icon, registeredIcons } from "../electron/icon_manager.js"
import { GibbLogger } from "../electron/logger.js"

const LOGGER = new GibbLogger("BootStrap")

const twitchIconTemplate = `<svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 32 32" class="icon twitch">
	<g transform="matrix(3.8 0 0 3.8 6.9e-5 -7.5e-5)" fill-rule="evenodd">
		<path d="m2.6 0.53v4.8h1.1v1.1l1.1-1.1h1.3l1.3-1.3v-3.4zm-2.1 1.1v5.3h2.1v1.6l1.6-1.6h1.3l2.4-2.4v-4.5h-5.8"/>
		<path d="m4.2 1.6h0.53v1.9h-0.53z"/>
		<path d="m5.8 1.6h0.53v1.9h-0.53z"/>
	</g>
</svg>`
const youtubeIconTemplate = `<svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 32 32" class="icon yt">
  <path d="M3.5 26.4a4 4 0 0 1-2.8-2.8C0 21 0 16 0 16s0-5.1.7-7.6a4 4 0 0 1 2.8-2.8C6 5 16 5 16 5s10 0 12.5.6a4 4 0 0 1 2.8 2.8C32 11 32 16 32 16s0 5.1-.7 7.6a4 4 0 0 1-2.8 2.8C26 27 16 27 16 27s-10 0-12.5-.6M21 16l-8.3-4.7v9.4Z"/>
</svg>`

export function register() {
	new Icon("icon.service.twitch", twitchIconTemplate)
	new Icon("icon.service.youtube", youtubeIconTemplate)
	
	LOGGER.log(`Registered ${Object.keys(registeredIcons).length} custom icons`,"Icons")
}
