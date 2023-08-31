import { Dflow } from "./dflow.js";

export * from "./dflow.js";

type DataEventDetail = {
	pinId: Dflow.PinId;
	value: unknown;
};

class DataEvent extends CustomEvent<DataEventDetail> {
	constructor(pinId: Dflow.PinId, value: unknown) {
		super(DataEvent.eventName, { detail: { pinId, value } });
	}
	static eventName = "data";
}

class Emitter extends EventTarget {
	emit(pinId: Dflow.PinId, value: unknown) {
		this.dispatchEvent(new DataEvent(pinId, value));
	}
}

class MyOutMap extends Map<Dflow.PinId, unknown> {
	emitter = new Emitter();
	set(pinId: string, value: unknown) {
		super.set(pinId, value);
		this.emitter.emit(pinId, value);
		return this;
	}
}

export class DflowExecutor extends Dflow {
	out = new MyOutMap();
	graph = new Map<Dflow.NodeId, DflowExecutor>();

	constructor() {
		super();
		this.out = new MyOutMap();
		this.out.emitter.addEventListener(DataEvent.eventName, this);
	}

	// *childNodes(pinId: Dflow.PinId): Generator<Dflow.NodeId> {
	// 	for (let [to, from] of this.pipe.entries())
	// 		if (from === pinId) yield Dflow.nodeIdOfPin(to);
	// }

	// async emit(pinId: Dflow.PinId, value: unknown) {
	// 	this.out.set(pinId, value);
	// 	for (const childNodeId of this.childNodes(pinId))
	// 		await this.runNode(childNodeId);
	// }

	// createFuncContext(nodeId: Dflow.NodeId) {
	// 	return {
	// 		emit: this.emit.bind(this, nodeId),
	// 	};
	// }

	handleEvent(event: CustomEvent) {
		console.log(event.type, event);
	}
}
