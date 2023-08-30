import { Dflow } from "./dflow.js";

export * from "./dflow.js";

export class DflowExecutor extends Dflow {
	get data() {
		return Object.fromEntries(this.out.entries());
	}

	emit() {
		console.log("emit");
	}

	addNode(
		name: Dflow.Node["name"],
		id = Math.random().toString(36).substring(2),
	): Dflow.NodeId {
		this.node.set(id, name);
		return id;
	}
}
