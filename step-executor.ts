import { Dflow } from "./dflow.js";

export class DflowStepExecutor extends Dflow {
	get data() {
		return Object.fromEntries(this.out.entries());
	}

	addNode(
		name: Dflow.Node["name"],
		id = Math.random().toString(36).substring(2),
	): Dflow.NodeId {
		this.node.set(id, name);
		return id;
	}
}
