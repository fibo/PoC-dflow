import { DflowStepExecutor } from "./executors.ts"

const dflow = new DflowStepExecutor([
	{
		name: "Math.sin",
		ins: [{ name: "arg" }],
		outs: [{ name: "out" }],
		fun: "return Math.sin(arg)",
	},
	{
		name: "Math.PI",
		outs: [{ name: "out" }],
		fun: [
			"console.log('Math.PI', Math.PI)",
			"return Math.PI",
		],
	},
], {
	nodes: [
		{ id: "dd892e13", name: "Math.PI" },
		{ id: "558b4cfb", name: "Math.sin" },
		{ id: "cd3e2b9f", name: "graph" },
	],
	pipes: [{ id: "0ca72f01", from: "dd892e13", to: "558b4cfb" }],
})

dflow.start()

console.log(JSON.stringify(dflow.toObject(), null, 2))
