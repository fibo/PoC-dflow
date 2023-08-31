// import { Dflow } from "./dflow.js";
import { DflowExecutor } from "./executor.js";

const dflow = new DflowExecutor();

dflow.setNodeFunc({
	name: "counter",
	code: ["let n = 0", "return () => {", "n += 1", "this.emit(n)", "}"],
});
dflow.context.set("counter", dflow);

dflow.setNodeFunc({
	name: "setInterval",
	args: ["func"],
	code: "return setInterval(func, 1000)",
});

dflow.setNodeFunc({
	name: "setInterval2",
	args: ["func", "timeout"],
	code: ["if(timeout) return -1", "return setInterval(func, timeout)"],
});

const nodeId1 = dflow.addNode("counter");
const nodeId2 = dflow.addNode("setInterval");
dflow.addPipe({ from: nodeId1, to: nodeId2 });

await dflow.run();
