class IconElement extends HTMLElement {
	static observedAttributes = ["icon-id"]
	constructor(){super()}
	attributeChangedCallback(name,_,newValue) {
		if (name==='icon-id') window.iconManager.getIcon(newValue).then((iconObj)=>{this.innerHTML=iconObj.svg})
	}
}
customElements.define("icon-element",IconElement)