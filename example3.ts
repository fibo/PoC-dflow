import { DflowStepExecutor } from "./executors.ts"

function hello() {
	console.log("hello")
}

const dflow = new DflowStepExecutor(
	[
		{
			name: "Math.sin",
			ins: [{ name: "arg" }],
			fun: "return Math.sin(arg)",
		},
		{
			name: "Math.PI",
			fun: ["console.info('Math.PI', Math.PI)", "return Math.PI"],
		},
	],
	[
		{
			name: hello.name,
			fun: hello,
		},
	],
	{
		nodes: [
			{ id: "dd892e13", name: "Math.PI" },
			{ id: "558b4cfb", name: "Math.sin" },
			{ id: "cd3e2b9f", name: "graph" },
			{ id: "dc3e29fb", name: "hello" },
		],
		pipes: [{ id: "0ca72f01", from: "dd892e13", to: "558b4cfb" }],
	},
)

dflow.start()

console.log(JSON.stringify(dflow.toObject(), null, 2))
