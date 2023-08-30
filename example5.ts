// import { Dflow } from "./dflow.js";
import { DflowExecutor } from "./executor.js";

const dflow = new DflowExecutor();

dflow.setNodeFunc({
	name: "LFO",
	code: "return () => this.emit()",
});
dflow.context.set("LFO", dflow);

dflow.setNodeFunc({
	name: "setInterval",
	args: ["func"],
	code: "return setInterval(func, 2000)",
});

dflow.setNodeFunc({
	name: "setInterval2",
	args: ["func", "timeout"],
	code: ["if(timeout) return -1", "return setInterval(func, timeout)"],
});

const nodeId1 = dflow.addNode("LFO");
const nodeId2 = dflow.addNode("setInterval");
dflow.addPipe({ from: nodeId1, to: nodeId2 });

await dflow.run();
