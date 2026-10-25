

// #region sidebar

let sidebarRootElement = null

function toggleSidebar() {
	if (sidebarRootElement == null)return
	if (sidebarRootElement.classList.contains("state-collapsed")) {
		sidebarRootElement.classList.remove('state-collapsed')
		sidebarRootElement.classList.add('state-expanded')
	} else {
		sidebarRootElement.classList.add('state-collapsed')
		sidebarRootElement.classList.remove('state-expanded')
	}
}

function init() {
	sidebarRootElement = document.querySelector('#app-main-sidebar')
	document.querySelector(".sidebar-element.app-sidebar-toggle").addEventListener('click', toggleSidebar)
}

init()