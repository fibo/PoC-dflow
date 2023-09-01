const html = (strings: TemplateStringsArray, ...expressions: string[]) => {
	const template = document.createElement("template");
	template.innerHTML = strings.reduce(
		(result, string, index) => result + string + (expressions[index] ?? ""),
		"",
	);
	return template;
};

export class Canvas extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.shadowRoot?.appendChild(Canvas.template.content.cloneNode(true));
	}
	static template = html`
		<style>
			:host {
				position: relative;
				display: block;
				overflow: hidden;
			}
			div {
				border: 1px solid black;
				width: 800px;
				height: 600px;
			}
		</style>
		<div><slot></slot></div>
	`;
}

export class Node extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.shadowRoot?.appendChild(Node.template.content.cloneNode(true));
		this.addEventListener("dragstart", this);
	}
	handleEvent(event: Event) {
		if (event instanceof DragEvent) {
			console.log(event);
		}
	}
static template = html`
	<style>
		:host {
			position: absolute;
		}
		div {
			border: 1px solid black;
			width: 100px;
			height: 20px;
		}
	</style>
	<div>node</div>
`;

}
