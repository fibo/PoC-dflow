import { Dflow } from "./dflow.ts";

const dflow = new Dflow();

dflow.setNodeFunc({
	name: "Math.sin",
	args: ["arg"],
	code: "return Math.sin(arg)",
});

dflow.setNodeFunc({
	name: "Math.PI",
	code: "return Math.PI",
});

dflow.setNodeGraph({
	name: "graph",
	nodes: [
		{ id: "dd892e13", name: "Math.PI" },
		{ id: "558b4cfb", name: "Math.sin" },
		{ id: "cd3e2b9f", name: "graph" },
	],
	pipes: [{ from: "dd892e13", to: "558b4cfb" }],
});

dflow.addNode("graph");

console.info(JSON.stringify(dflow, null, 2));
