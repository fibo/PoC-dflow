import flowView from "./html/flow-view.js"
import fvCanvas from "./html/fv-canvas.js"
import fvNode from "./html/fv-node.js"
import fvPin from "./html/fv-pin.js"
import fvSelection from "./html/fv-selection.js"

export declare namespace FlowView {
	type NodeId = string
}

const htmlTemplate = (content: string) => {
	const template = document.createElement("template")
	template.innerHTML = content
	return template
}

class FVcanvas extends HTMLElement {
	observer: MutationObserver
	selectedNodes = new Set<FVnode>()
	constructor() {
		super()
		this.attachShadow({ mode: "open" })
		this.shadowRoot?.appendChild(FVcanvas.template.content.cloneNode(true))
		this.observer = new MutationObserver((mutationList) => {
			for (const mutation of mutationList) {
				if (mutation.type === "childList") {
					mutation.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement)
							if (node.tagName === FVnode.tagName)
								node.addEventListener("pointerdown", this)
					})
					mutation.removedNodes.forEach((node) => {
						if (node instanceof HTMLElement)
							if (node.tagName === FVnode.tagName)
								node.removeEventListener("pointerdown", this)
					})
				}
			}
		})
	}
	connectedCallback() {
		this.observer.observe(this, {
			attributes: false,
			childList: true,
			subtree: true
		})
		document.querySelectorAll<FVnode>(FVnode.tagName).forEach((element) => {
			element.addEventListener("pointerdown", this)
		})
	}
	disconnectedCallback() {
		this.observer.disconnect()
	}
	handleEvent(event: Event) {
		if (event.type === "pointerdown" && event.target instanceof FVnode) {
			this.selectedNodes.add(event.target)
			const x = event.target.getAttribute("x")
			const y = event.target.getAttribute("y")
			const selection = this.shadowRoot?.querySelector<FVselection>(
				FVselection.tagName
			)
			if (x && y) {
				selection?.setAttribute("x", x)
				selection?.setAttribute("y", y)
			}
		}
	}
	static tagName = "FV-CANVAS"
	static template = htmlTemplate(fvCanvas)
}

class FVselection extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: "open" })
		this.shadowRoot?.appendChild(
			FVselection.template.content.cloneNode(true)
		)
	}
	attributeChangedCallback(name: string, _oldValue: string, value: string) {
		if (!isNaN(parseInt(value))) {
			if (name === "x") this.style.left = `${value}px`
			if (name === "y") this.style.top = `${value}px`
			if (name === "w") this.style.width = `${value}px`
			if (name === "h") this.style.height = `${value}px`
		}
	}
	clear() {
		;["x", "y", "w", "h"].forEach((attr) => this.setAttribute(attr, "0"))
	}
	static get observedAttributes() {
		return ["x", "y", "w", "h"]
	}
	static tagName = "FV-SELECTION"
	static template = htmlTemplate(fvSelection)
}

class FVpin extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: "open" })
		this.shadowRoot?.appendChild(FVpin.template.content.cloneNode(true))
		this.addEventListener("drag", this)
		this.addEventListener("dragstart", this)
		this.addEventListener("pointerdown", this)
	}
	handleEvent(event: Event) {
		if (event.type === "pointerdown") event.stopPropagation()
		if (event instanceof DragEvent) {
			console.log(event)
		}
	}
	static tagName = "FV-PIN"
	static template = htmlTemplate(fvPin)
}

class FVnode extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: "open" })
		this.shadowRoot?.appendChild(FVnode.template.content.cloneNode(true))
	}
	attributeChangedCallback(name: string, _oldValue: string, value: string) {
		if (!isNaN(parseInt(value))) {
			if (name === "x") this.style.left = `${value}px`
			if (name === "y") this.style.top = `${value}px`
		}
	}
	static get observedAttributes() {
		return ["x", "y"]
	}
	static tagName = "FV-NODE"
	static template = htmlTemplate(fvNode)
}

export class FlowView extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: "open" })
		this.shadowRoot?.appendChild(FlowView.template.content.cloneNode(true))
	}
	static tagName = "FLOW-VIEW"
	static template = htmlTemplate(flowView)
	static customElements = new Map<string, typeof HTMLElement>()
		.set(FlowView.tagName, FlowView)
		.set(FVcanvas.tagName, FVcanvas)
		.set(FVnode.tagName, FVnode)
		.set(FVpin.tagName, FVpin)
		.set(FVselection.tagName, FVselection)
	static defineCustomElements() {
		for (let [tagName, CustomElement] of FlowView.customElements.entries())
			if (!customElements.get(tagName))
				customElements.define(tagName.toLowerCase(), CustomElement)
	}
}
