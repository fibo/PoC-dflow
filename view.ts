export declare namespace FlowView {
	type NodeId = string;
	type Position = { x: number; y: number };
	export type NodeMovedEventDetail = { nodeId: FlowView.NodeId } & Position;
	export type NodeSelectedEventDetail = { nodeId: FlowView.NodeId };
}

const html = (strings: TemplateStringsArray, ...expressions: string[]) => {
	const template = document.createElement("template");
	template.innerHTML = strings.reduce(
		(result, string, index) => result + string + (expressions[index] ?? ""),
		"",
	);
	return template;
};

export class FlowView extends HTMLElement {
	static Canvas = class FlowViewCanvas extends HTMLElement {
		constructor() {
			super();
			this.attachShadow({ mode: "open" });
			this.shadowRoot?.appendChild(
				FlowView.Canvas.template.content.cloneNode(true),
			);
		}
		static tagName = "fv-canvas";
		static template = html`
			<style>
				:host {
					position: relative;
					display: block;
					overflow: hidden;
					/* transform: translate(-10px, -10px); */
				}
				div {
					border: 1px solid black;
					width: 800px;
					height: 600px;
				}
			</style>
			<div><slot></slot></div>
		`;
	};

	static Node = class FlowViewNode extends HTMLElement {
		constructor() {
			super();
			this.attachShadow({ mode: "open" });
			this.shadowRoot?.appendChild(
				FlowView.Node.template.content.cloneNode(true),
			);
			this.addEventListener("dragstart", this);
		}
		attributeChangedCallback(
			name: string,
			_oldValue: string,
			value: string,
		) {
			if (!isNaN(parseInt(value))) {
				if (name === "x") this.style.left = `${value}px`;
				if (name === "y") this.style.top = `${value}px`;
			}
		}
		handleEvent(event: Event) {
			if (event instanceof DragEvent) {
				console.log(event);
			}
		}
		static get observedAttributes() {
			return ["x", "y"];
		}
		static tagName = "fv-node";
		static template = html`
			<style>
				:host {
					position: absolute;
				}
				div {
					border: 1px solid black;
				}
			</style>
			<div>node</div>
		`;
		static Moved = class FlowViewNodeMoved extends CustomEvent<{
			nodeId: string;
		}> {
			constructor(detail: { nodeId: string }) {
				super(FlowView.Node.Moved.eventName, { detail });
			}
			static eventName = "fv-nodemoved";
		};
		static Selected = class FlowViewNodeSelected extends CustomEvent<{
			nodeId: string;
		}> {
			constructor(detail: { nodeId: string }) {
				super(FlowView.Node.Selected.eventName, { detail });
			}
			static eventName = "fv-nodeselected";
		};
	};

	static customElements = new Map<
		string,
		typeof FlowView.Canvas | typeof FlowView.Node
	>()
		.set(FlowView.Canvas.tagName, FlowView.Canvas)
		.set(FlowView.Node.tagName, FlowView.Node);

	static defineCustomElements() {
		for (let [tagName, CustomElement] of FlowView.customElements.entries())
			if (!customElements.get(tagName))
				customElements.define(tagName, CustomElement);
	}
}
