import {
	DflowExecutor,
	DflowGraph,
	DflowGraphObject,
	DflowNodeDefinition,
	DflowNode,
	DflowPipe,
DflowInObject,
} from "./dflow.ts"

type DflowNodeConnection = Pick<DflowPipe, "from" | "to">

const parentsOfNodeId = (
	nodeId: string,
	nodeConnections: DflowNodeConnection[],
) => {
	return nodeConnections
		.filter(({ to }) =>
			typeof to === "string" ? to === nodeId : to[0] === nodeId
		)
		.map(({ from }) => typeof from === "string" ? from : from[0])
}

const levelOfNodeId = (
	nodeId: string,
	nodeConnections: DflowNodeConnection[],
) => {
	const parentsNodeIds = parentsOfNodeId(nodeId, nodeConnections)
	// 1. A node with no parent as level zero.
	if (parentsNodeIds.length === 0) return 0
	// 2. Otherwise its level is the max level of its parents plus one.
	let maxLevel = 0
	for (const parentNodeId of parentsNodeIds) {
		const level = levelOfNodeId(parentNodeId, nodeConnections)
		maxLevel = Math.max(level, maxLevel)
	}
	return maxLevel + 1
}

const sortNodeIdsByLevel = (
	nodeIds: string[],
	nodeConnections: DflowNodeConnection[],
): string[] => {
	const levelOf: Record<string, number> = {}
	for (const nodeId of nodeIds) {
		levelOf[nodeId] = levelOfNodeId(nodeId, nodeConnections)
	}
	return nodeIds.slice().sort((a, b) => (levelOf[a] <= levelOf[b] ? -1 : 1))
}

type FunctionNode = {
  name: string
	ins?: DflowInObject[]
  fun: (...args: unknown[]) => unknown
}

export class DflowStepExecutor implements DflowExecutor {
	status: DflowExecutor["status"]
	graph: DflowGraph
	functions: Map<DflowNode['id'], (...args: unknown[]) => unknown>
	functionNodes: Map<DflowNode['name'], (...args: unknown[]) => unknown>
	functionNodesIns: Map<DflowNode['name'], DflowInObject[]>
	modules: Map<DflowNode['id'], DflowStepExecutor>
	nodeDefinitions: DflowNodeDefinition[]

	constructor(
		nodeDefinitions: DflowNodeDefinition[],
    functionNodes: FunctionNode[],
		{ nodes, pipes }: Pick<DflowGraphObject, "nodes" | "pipes">,
	) {
		this.status = "initialized"

		const graph = new DflowGraph()
		graph.addNodeDefinitions(nodeDefinitions)
		graph.insert({ nodes, pipes })
		this.graph = graph

		this.nodeDefinitions = nodeDefinitions

    this.functionNodes = new Map()
    this.functionNodesIns = new Map()
    for (const functionNode of functionNodes) {
this.functionNodes.set(functionNode.name,functionNode.fun)
this.functionNodesIns.set(functionNode.name,functionNode.ins??[])
    }

		this.functions = new Map()
		this.modules = new Map()
	}

async	start() {
		this.status = "running"

		for (const node of this.graph.nodes.values()) {
			const nodeDefinition = this.graph.nodeDefinitions.get(node.name)
			if (!nodeDefinition) {
				continue
			}

			const {name, graph, fun, ins = [] } = nodeDefinition

      const functionNode = this.functionNodes.get(name)
      if (functionNode) {
				this.functions.set(
					node.id,
          functionNode
				)
      } else if (fun) {
				this.functions.set(
					node.id,
					new Function(
						...ins.map(({ name }) => name),
						typeof fun === "string" ? fun : fun.join(";"),
					) as (...args: unknown[]) => unknown,
				)
			} else if (graph) {
				this.modules.set(
					node.id,
					new DflowStepExecutor(this.nodeDefinitions,
         Array.from(this.functionNodes.entries()).map(([name, fun]) => ({name, fun}))
          , graph),
				)
			}

		}

		const nodeIds = sortNodeIdsByLevel(
			Array.from(this.graph.nodes.keys()),
			Array.from(this.graph.pipes.values()),
		)

		NODES:
		for (const nodeId of nodeIds) {
			const node = this.graph.nodes.get(nodeId)
			if (!node) {
				continue NODES
			}
			const args: unknown[] = []

			INS:
			for (const { pipe } of node.ins) {
				if (!pipe) {
					continue INS
				}
				const { sourceNodeId, sourcePosition } = typeof pipe.from === "string"
					? { sourceNodeId: pipe.from, sourcePosition: 0 }
					: { sourceNodeId: pipe.from[0], sourcePosition: pipe.from[1] }
				const sourceNode = this.graph.nodes.get(sourceNodeId)

				if (!sourceNode) {
					continue INS
				}

				const sourceNodeOut = sourceNode.outs[sourcePosition]
				if (!sourceNodeOut) {
					continue INS
				}

				args.push(sourceNodeOut.value)
			}

			const fun = this.functions.get(nodeId)
			if (fun) {
      if (fun.constructor.name === 'AsyncFunction') {
			await fun.apply(args)
      } else {
        fun.apply(args)
      }
			}

      const mod = this.modules.get(nodeId)
      if (mod) {
        // TODO valorizza gli input del modulo
        await mod.start()
        // TODO leggi gli output del modulo
      }
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
