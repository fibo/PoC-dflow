import { DflowGraph } from "./dflow.ts"

const graph = new DflowGraph()

graph.addNodeDefinitions([
	{
		name: "Math.sin",
		ins: [{ name: "arg" }],
		outs: [{ name: "out" }],
		fun: "return Math.sin(arg)",
	},
	{
		name: "Math.PI",
		outs: [{ name: "out" }],
		fun: "return Math.PI",
	},
	{
		name: "graph",
		graph: {
			nodes: [
				{ id: "dd892e13", name: "Math.PI" },
				{ id: "558b4cfb", name: "Math.sin" },
				{ id: "cd3e2b9f", name: "graph" },
			],
			pipes: [{ id: "0ca72f01", from: "dd892e13", to: "558b4cfb" }],
		},
	},
])

graph.addNode("graph")

console.log(JSON.stringify(graph.toObject(), null, 2))
