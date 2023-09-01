const html = (strings, ...expressions) => {
  const template = document.createElement("template");
  template.innerHTML = strings.reduce(
    (result, string, index) => result + string + (expressions[index] ?? ""),
    ""
  );
  return template;
};
class FlowView extends HTMLElement {
  static Canvas = class FlowViewCanvas extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot?.appendChild(
        FlowView.Canvas.template.content.cloneNode(true)
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
        FlowView.Node.template.content.cloneNode(true)
      );
      this.addEventListener("dragstart", this);
    }
    attributeChangedCallback(name, _oldValue, value) {
      if (!isNaN(parseInt(value))) {
        if (name === "x")
          this.style.left = `${value}px`;
        if (name === "y")
          this.style.top = `${value}px`;
      }
    }
    handleEvent(event) {
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
    static Moved = class FlowViewNodeMoved extends CustomEvent {
      constructor(detail) {
        super(FlowView.Node.Moved.eventName, { detail });
      }
      static eventName = "fv-nodemoved";
    };
    static Selected = class FlowViewNodeSelected extends CustomEvent {
      constructor(detail) {
        super(FlowView.Node.Selected.eventName, { detail });
      }
      static eventName = "fv-nodeselected";
    };
  };
  static customElements = (/* @__PURE__ */ new Map()).set(FlowView.Canvas.tagName, FlowView.Canvas).set(FlowView.Node.tagName, FlowView.Node);
  static defineCustomElements() {
    for (let [tagName, CustomElement] of FlowView.customElements.entries())
      if (!customElements.get(tagName))
        customElements.define(tagName, CustomElement);
  }
}
export {
  FlowView
};
