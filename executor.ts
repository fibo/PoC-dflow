import { Dflow } from "./dflow.js";

export * from "./dflow.js";

export class DflowExecutor extends Dflow {
	get data() {
		return Object.fromEntries(this.out.entries());
	}

	*childNodes(pinId: Dflow.PinId): Generator<Dflow.NodeId> {
		for (let [to, from] of this.pipe.entries())
			if (from === pinId) yield Dflow.nodeIdOfPin(to);
	}

	async emit(pinId: Dflow.PinId, value: unknown) {
		this.out.set(pinId, value);
		for (const childNodeId of this.childNodes(pinId))
			await this.runNode(childNodeId);
	}

	createFuncContext(nodeId: Dflow.NodeId) {
		return {
			emit: this.emit.bind(this, nodeId),
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
