import {
	DflowExecutor,
	DflowGraph,
	DflowGraphObject,
	DflowInObject,
	DflowNode,
	DflowNodeDefinition,
	DflowPipe,
} from "./dflow.ts"

type FunctionNode = {
	name: string
	ins?: DflowInObject[]
	fun: (...args: unknown[]) => unknown
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
const AsyncFunction = async function () {}.constructor

// TODO
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
	outMap: Map<string, unknown>

	static outId(pipeFrom: DflowPipe["from"]) {
		return typeof pipeFrom === "string" ? pipeFrom : pipeFrom.join()
	}

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
		this.outMap = new Map()
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

		// TODO
		// devo fare una cosa del genere che facevo prima nella graph.insert
		// cioe mi preparo le connessioni tra gli input e i pipe
		// in modo da ricavare il valore dell out
		//
		// for (const { id, from, to } of pipes) {
		//   const { sourceNodeId, sourcePosition } =
		//     typeof from === "string"
		//       ? { sourceNodeId: from, sourcePosition: 0 }
		//       : { sourceNodeId: from[0], sourcePosition: from[1] };
		//   const sourceNode = this.nodes.get(sourceNodeId);
		//   if (!sourceNode) {
		//     continue;
		//   }
		//   const sourceNodeDefinition = this.nodeDefinitions.get(sourceNode.name);
		//   if (!sourceNodeDefinition) {
		//     continue;
		//   }
		//   const sourceOutDefinition = sourceNodeDefinition.outs?.[sourcePosition];
		//   if (!sourceOutDefinition) {
		//     continue;
		//   }

		//   const { targetNodeId, targetPosition } =
		//     typeof to === "string"
		//       ? { targetNodeId: to, targetPosition: 0 }
		//       : { targetNodeId: to[0], targetPosition: to[1] };
		//   const targetNode = this.nodes.get(targetNodeId);
		//   if (!targetNode) {
		//     continue;
		//   }
		//   const targetNodeDefinition = this.nodeDefinitions.get(targetNode.name);
		//   if (!targetNodeDefinition) {
		//     continue;
		//   }
		//   const targetOutDefinition = targetNodeDefinition.ins?.[targetPosition];
		//   if (!targetOutDefinition) {
		//     continue;
		//   }

		//   const targetIn = targetNode.ins[targetPosition];
		//   if (!targetIn) {
		//     continue;
		//   }
		//   }
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
			console.log(node)
			if (!node) {
				continue NODES
			}
			const args: unknown[] = []

			INS:
			for (const { pipe } of node.ins) {
				if (!pipe) {
					continue INS
				}
				const outId = DflowStepExecutor.outId(pipe.from)
				args.push(this.outMap.get(outId))
			}

			console.info("execute node", nodeId, "args", args)

			const fun = this.functions.get(nodeId)

			if (fun) {
				if (fun.constructor === AsyncFunction.constructor) {
					const data = await fun.apply(null, args)
					this.outMap.set(DflowStepExecutor.outId(nodeId), data)
				} else {
					const data = fun.apply(null, args)
					this.outMap.set(DflowStepExecutor.outId(nodeId), data)
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
