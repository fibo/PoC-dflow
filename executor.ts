import { Dflow } from "./dflow.js"

export * from "./dflow.js"

type DataEventDetail = {
	pinId: Dflow.PinId
	value: unknown
}

class DataEvent extends CustomEvent<DataEventDetail> {
	constructor(pinId: Dflow.PinId, value: unknown) {
		super(DataEvent.eventName, { detail: { pinId, value } })
	}
	static eventName = "data"
}

class StopEvent extends Event {
	constructor() {
		super(StopEvent.eventName)
	}
	static eventName = "stop"
}

class Emitter extends EventTarget {
	emit(pinId: Dflow.PinId, value: unknown) {
		this.dispatchEvent(new DataEvent(pinId, value))
	}
	stop(callback: EventListener) {
		this.addEventListener(StopEvent.eventName, callback)
	}
}

// class MyOutMap extends Map<Dflow.PinId, unknown> {
// 	emitter = new Emitter();
// 	set(pinId: string, value: unknown) {
// 		super.set(pinId, value);
// 		this.emitter.emit(pinId, value);
// 		return this;
// 	}
// }

export class DflowExecutor extends Dflow {
	// out = new MyOutMap();
	// graph = new Map<Dflow.NodeId, DflowExecutor>();
	emitter: Emitter

	nodesWithContext: Set<Dflow.NodeName>

	constructor() {
		super()
		// this.out = new MyOutMap();
		const emitter = new Emitter()
		emitter.addEventListener(DataEvent.eventName, this)
		emitter.addEventListener(StopEvent.eventName, this)
		this.emitter = emitter

		this.nodesWithContext = new Set()
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

	emit(pinId: Dflow.PinId, value: unknown) {
		this.out.set(pinId, value)
		this.emitter.emit(pinId, value)
	}

	handleEvent(event: CustomEvent) {
		console.log(event.type, event)
	}

	addNode(name: Dflow.NodeName, id: Dflow.NodeId): Dflow.NodeId {
		super.addNode(name, id)
		if (this.nodesWithContext.has(name))
			this.context.set(id, {
				emit: this.emit.bind(this, Dflow.pinToPinId([id, 1])),
				stop: this.emitter.stop.bind(this.emitter)
			})
		return id
	}

	setNodeFunc({ name, args, code }: Dflow.NodeFunc) {
		super.setNodeFunc({ name, args, code })
		const funcBody = Dflow.funcBody(code)
		if (funcBody.includes("this.emit") || funcBody.includes("this.stop"))
			this.nodesWithContext.add(name)
	}

	async start() {
		await this.run()
	}

	stop() {
		console.log("stop")
		this.emitter.dispatchEvent(new StopEvent())
	}
}
