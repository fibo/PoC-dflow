import { DflowStepExecutor } from "./step-executor.ts";

function hello() {
	console.info("hello world");
}

const dflow = new DflowStepExecutor();

dflow.setNodeFunc({
	name: "Math.sin",
	args: ["arg"],
	code: "return Math.sin(arg)",
});

dflow.setNodeFunc({
	name: "Math.PI",
	code: ["console.info('Math.PI', Math.PI)", "return Math.PI"],
});

dflow.setNodeGraph({
	name: "empty",
	nodes: [],
	pipes: [],
});

dflow.setFunc("hello", hello);

dflow.insert({
	nodes: [
		{ id: "dd892e13", name: "Math.PI" },
		{ id: "558b4cfb", name: "Math.sin" },
		{ id: "cd3e2b9f", name: "graph" },
		{ id: "dc3e29fb", name: "hello" },
		{ id: "5854bfbc", name: "empty" },
	],
	pipes: [{ from: "dd892e13", to: "558b4cfb" }],
});

await dflow.run();

console.info(JSON.stringify(dflow, null, 2));
