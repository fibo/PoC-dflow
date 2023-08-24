import {
	DflowExecutor,
	DflowGraph,
	DflowGraphObject,
	DflowInObject,
	DflowNode,
	DflowNodeDefinition,
} from "./dflow.ts"

type FunctionNode = {
	name: string
	ins?: DflowInObject[]
	fun: (...args: unknown[]) => unknown
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
const AsyncFunction = async function () {}.constructor

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/GeneratorFunction/GeneratorFunction
// const GeneratorFunction = function* () {}.constructor;

export class DflowStepExecutor implements DflowExecutor {
	status: DflowExecutor["status"]
	graph: DflowGraph
	functions: Map<DflowNode["id"], (...args: unknown[]) => unknown>
	functionNodes: Map<DflowNode["name"], (...args: unknown[]) => unknown>
	functionNodesIns: Map<DflowNode["name"], DflowInObject[]>
	modules: Map<DflowNode["id"], DflowStepExecutor>
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
			this.functionNodes.set(functionNode.name, functionNode.fun)
			this.functionNodesIns.set(functionNode.name, functionNode.ins ?? [])
		}

		this.functions = new Map()
		this.modules = new Map()
	}

	prepare() {
		for (const node of this.graph.nodes.values()) {
			const nodeDefinition = this.graph.nodeDefinitions.get(node.name)
			if (!nodeDefinition) {
				continue
			}

			const { name, graph, fun, ins = [] } = nodeDefinition

			const functionNode = this.functionNodes.get(name)
			if (functionNode) {
				this.functions.set(node.id, functionNode)
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
					new DflowStepExecutor(
						this.nodeDefinitions,
						Array.from(this.functionNodes.entries()).map(([name, fun]) => ({
							name,
							fun,
						})),
						graph,
					),
				)
			}
		}
	}

	nodeIdsSortedByLevel() {
		const nodeIds = Array.from(this.graph.nodes.keys())
		const pipes = Array.from(this.graph.pipes.values())

		const levelOfNode: Record<
			DflowNode["id"],
			ReturnType<typeof DflowGraph.levelOfNode>
		> = {}
		for (const nodeId of nodeIds) {
			levelOfNode[nodeId] = DflowGraph.levelOfNode(nodeId, pipes)
		}
		return nodeIds.sort((nodeIdA, nodeIdB) =>
			levelOfNode[nodeIdA] <= levelOfNode[nodeIdB] ? -1 : 1
		)
	}

	async run() {
		const nodeIds = this.nodeIdsSortedByLevel()

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
				console.info("execute function node", nodeId, "args", ...args)
				if (fun.constructor === AsyncFunction.constructor) {
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
	}

	async start() {
		this.status = "running"
		this.prepare()
		await this.run()
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
