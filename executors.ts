import {
	DflowExecutor,
	DflowGraph,
	DflowGraphObject,
	DflowNodeDefinition,
} from "./dflow.ts"

export class DflowStepExecutor implements DflowExecutor {
	status: DflowExecutor["status"]
	graph: DflowGraph

	constructor(
		nodeDefinitions: DflowNodeDefinition[],
		{ nodes, pipes }: Pick<DflowGraphObject, "nodes" | "pipes">,
	) {
		this.status = "initialized"

		const graph = new DflowGraph()
		graph.addNodeDefinitions(nodeDefinitions)
		graph.insert({ nodes, pipes })
		this.graph = graph
	}

	start() {
		this.status = "running"

		for (const node of this.graph.nodes.values()) {
			const nodeDefinition = this.graph.nodeDefinitions.get(node.name)
			console.log(node, nodeDefinition)
		}

		this.status = "idle"
	}

	stop() {}

	toObject() {
		return {
			className: "DflowStepExecutor",
			status: this.status,
		}
	}
}

export class DflowRealTimeExecutor implements DflowExecutor {
	status: DflowExecutor["status"]
	graph: DflowGraph

	constructor(nodeDefinitions: DflowNodeDefinition[]) {
		this.status = "initialized"

		const graph = new DflowGraph()
		graph.addNodeDefinitions(nodeDefinitions)
		this.graph = graph
	}

	start() {
		this.status = "running"
	}

	stop() {
		this.status = "idle"
	}

	toObject() {
		return {
			className: "DflowRealTimeExecutor",
			status: this.status,
		}
	}
}
