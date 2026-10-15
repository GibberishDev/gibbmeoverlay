class IconElement extends HTMLElement {
	static observedAttributes = ["icon-id"]
	constructor(){super()}
	connectedCallback() {
		console.log("Custom element added to page.");
	}

	disconnectedCallback() {
		console.log("Custom element removed from page.");
	}

	connectedMoveCallback() {
		console.log("Custom element moved with moveBefore()");
	}

	adoptedCallback() {
		console.log("Custom element moved to new page.");
	}

	attributeChangedCallback(name, oldValue, newValue) {
		console.log(`Attribute ${name} has changed.`);
		console.log(window.iconManager.getIcon(newValue).then((iconObj)=>{this.innerHTML=iconObj.svg}))
		// this.innerHTML = window.iconManager.getIcon(newValue)
	}
}

customElements.define("icon-element",IconElement)