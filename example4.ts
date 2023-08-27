import { DflowStepExecutor } from "./step-executor.ts"

const dflow = new DflowStepExecutor()

dflow.setNodeFunc({
	name: "Math.PI",
	code: "return Math.PI",
})

dflow.setNodeFunc({
	name: "double",
	args: ["arg"],
	code: "return 2 * args",
})

const subGraph = new DflowStepExecutor({
	name: "graph",
	args: ["input"],
	outs: ["output"],
	nodes: [],
	pipes: [],
})

const subGraphNodeId1 = subGraph.addNode("input")
const subGraphNodeId2 = subGraph.addNode("double")
const subGraphNodeId3 = subGraph.addNode("output")

subGraph.addPipe({ from: subGraphNodeId1, to: subGraphNodeId2 })
subGraph.addPipe({ from: subGraphNodeId2, to: subGraphNodeId3 })

console.log(JSON.stringify(subGraph, null, 2))

dflow.setNodeGraph(subGraph.toValue())

const nodeId1 = dflow.addNode("Math.PI")
const nodeId2 = dflow.addNode("graph")
dflow.addPipe({ from: nodeId1, to: nodeId2 })

await dflow.run()

console.log(JSON.stringify(dflow, null, 2))
console.log(JSON.stringify(dflow.data, null, 2))
