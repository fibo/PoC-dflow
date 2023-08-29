import { Dflow } from "./dflow.js";

const dflow = new Dflow();

const PI: Dflow.NodeFunc = {
	name: "Math.PI",
	code: "return Math.PI",
};

dflow.setNodeFunc({
	name: "Math.sin",
	args: ["arg"],
	code: "return Math.sin(arg)",
});

dflow.setNodeFunc(PI);

const nodeId1 = dflow.addNode("Math.PI");
const nodeId2 = dflow.addNode("Math.sin");

dflow.addPipe({ from: nodeId1, to: nodeId2 });

console.info(JSON.stringify(dflow, null, 2));
