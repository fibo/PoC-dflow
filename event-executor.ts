import { Dflow } from "./dflow.js";

export class DflowEventExecutor extends Dflow {
	constructor(arg: Dflow.NodeGraph) {
		super(arg);
	}

	get data() {
		return Object.fromEntries(this.out.entries());
	}

	setOut(key: Dflow.PinId, value: unknown) {
		this.out.set(key, value);
		console.log(key, value);
	}

	async stop() {}
}
