export var registeredIcons = {}

export class Icon {
    constructor(id, svg) {
        this.id = id
        this.svg = svg
        registeredIcons[id] = this
    }
    getElement(width, height, highlightParentElement=undefined){
        let iconElement = document.createElement("div")
        iconElement.innerHTML = this.svg
        let svgElement = iconElement.querySelector("svg")
        svgElement.dataset.id = this.id
        svgElement.setAttribute("width", width);
        svgElement.setAttribute("height", height);
		svgElement.classList.add("icn-"+this.id.replace(".","-"))
        if (highlightParentElement!=undefined) {
            highlightParentElement.addEventListener("mouseover", ()=>{svgElement.classList.add("highlight")})
            highlightParentElement.addEventListener("mouseout", ()=>{svgElement.classList.remove("highlight")})
        } else {
            svgElement.addEventListener("mouseover", ()=>{svgElement.classList.add("highlight")})
            svgElement.addEventListener("mouseout", ()=>{svgElement.classList.remove("highlight")})
        }
        return svgElement
    }
}

