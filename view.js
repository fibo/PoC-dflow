class Base extends HTMLElement {
	constructor(template) {
		super();
		this.attachShadow({ mode: "open" });
		this.shadowRoot?.appendChild(template.content.cloneNode(true));
	}
	static template(html) {
		const template = document.createElement("template");
		template.innerHTML = html;
		return template;
	}
}
const canvasTemplate = Base.template(`
<style>
  div {
	border: 1px solid black;
	width: 800px;
	height: 600px;
  }
</style>
<div><slot></slot></div>
`);
class Canvas extends Base {
	constructor() {
		super(canvasTemplate);
		this.addEventListener("dragover", this);
		this.addEventListener("drop", this);
	}
	handleEvent(event) {
		if (event.type === "dragover") event.preventDefault();
		if (event.type === "drop") console.log(event);
	}
}
const nodeTemplate = Base.template(`
<style>
  div {
	border: 1px solid black;
	width: 100px;
	height: 20px;
  }
</style>
<div>node</div>
`);
class Node extends Base {
	constructor() {
		super(nodeTemplate);
		this.addEventListener("dragstart", this);
	}
	handleEvent(event) {
		if (event instanceof DragEvent) {
			console.log(event);
		}
	}
}
export { Canvas, Node };
