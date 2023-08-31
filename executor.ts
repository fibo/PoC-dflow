import { Dflow } from "./dflow.js";

export * from "./dflow.js";

export class DflowExecutor extends Dflow {
	get data() {
		return Object.fromEntries(this.out.entries());
	}

	*childrenOfNodeFunc(nodeId: Dflow.NodeId) {
		for (let [to, from] of this.pipe.entries())
			if (from === nodeId) yield Dflow.nodeIdOfPin(to);
	}

	emitFuncOut(nodeId: Dflow.NodeId, value: unknown) {
		this.out.set(nodeId, value);
		for (const childNodeId of this.childrenOfNodeFunc(nodeId))
			this.runNode(childNodeId);
	}

	createFuncContext(nodeId: Dflow.NodeId) {
		return {
			emit: this.emitFuncOut.bind(this, nodeId),
		};
	}

	addNode(
		name: Dflow.Node["name"],
		id = Math.random().toString(36).substring(2),
	): Dflow.NodeId {
		this.node.set(id, name);
		if (this.func.has(name))
			this.context.set(id, this.createFuncContext(id));
		return id;
	}
}
