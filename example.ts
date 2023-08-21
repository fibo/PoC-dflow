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
])

const node1 = graph.addNode("Math.PI")
const node2 = graph.addNode("Math.sin")

if (node1 && node2) {
	graph.addPipe({ from: node1.id, to: node2.id })
}

console.log(graph.toObject())
