// TODO forse anche generateId si puo togliere e mettere negli executor
const generateId = () => {
	return crypto.randomUUID().substring(0, 8)
}

// TODO gli output si possono sicuramente togliere
// cioe non sono classi ma solo un tipo definito dal nodo
// for anche gli input, se non serve il loro metodo pipe
//
// cosi facendo diventa tutto ultra flessibile, solo nodi e pipe
//
// inoltre i nodi avranno in genere un solo output, a meno che siano dei grafi

export type DflowInObject = Pick<DflowIn, "name">

class DflowIn {
	name: string
	pipe: DflowPipe | undefined

	constructor({ name }: DflowInObject) {
		this.name = name
		this.pipe = undefined
	}

	connect(pipe: DflowPipe) {
		this.pipe = pipe
	}

	toObject(): DflowInObject {
		return { name: this.name }
	}
}

type DflowOutObject = Pick<DflowOut, "name">

export class DflowOut {
	name: string
	value: unknown

	constructor({ name }: DflowOutObject) {
		this.name = name
		this.value = undefined
	}

	toObject(): DflowOutObject {
		return { name: this.name }
	}
}

type DflowPipeObject = Pick<DflowPipe, "id" | "from" | "to">

export class DflowPipe {
	id: string
	from: DflowNode["id"] | [nodeId: DflowNode["id"], outPosition: number]
	to: DflowNode["id"] | [nodeId: DflowNode["id"], inPosition: number]

	constructor({ id, from, to }: DflowPipeObject) {
		this.id = id
		this.from = from
		this.to = to
	}

	toObject(): DflowPipeObject {
		return { id: this.id, from: this.from, to: this.to }
	}
}

type DflowNodeObject = Pick<DflowNode, "id" | "name">

export type DflowNodeDefinition = {
	name: DflowNode["name"]
	fun?: DflowNode["fun"]
	ins?: DflowInObject[]
	outs?: DflowOutObject[]
	graph?: Pick<DflowGraphObject, "nodes" | "pipes">
}

type DflowNodeInstance = {
	id: string
	name: string
	ins: DflowIn[]
	outs: DflowOut[]
	toObject(): DflowNodeObject
}

export class DflowNode implements DflowNodeInstance {
	id: string
	name: string
	ins: DflowIn[]
	outs: DflowOut[]

	fun?: string | string[]

	constructor(
		{ ins = [], outs = [], fun, name }: DflowNodeDefinition,
		id = generateId(),
	) {
		this.id = id
		this.name = name
		this.fun = fun

		this.ins = []
		for (const item of ins) {
			this.ins.push(new DflowIn(item))
		}

		this.outs = []
		for (const item of outs) {
			this.outs.push(new DflowOut(item))
		}
	}

	toObject(): DflowNodeObject {
		return {
			id: this.id,
			name: this.name,
		}
	}
}

export type DflowGraphObject = {
	nodes: DflowNodeObject[]
	pipes: DflowPipeObject[]
	nodeDefinitions: DflowNodeDefinition[]
}

export class DflowGraph {
	nodes = new Map<DflowNode["id"], DflowNode>()
	pipes = new Map<DflowPipe["id"], DflowPipe>()
	nodeDefinitions = new Map<DflowNodeDefinition["name"], DflowNodeDefinition>()

	static parentNodeIds(
		nodeId: DflowNode["id"],
		pipes: Pick<DflowPipe, "from" | "to">[],
	): DflowNode["id"][] {
		return pipes
			.filter(({ to }) =>
				typeof to === "string" ? to === nodeId : to[0] === nodeId
			)
			.map(({ from }) => (typeof from === "string" ? from : from[0]))
	}

	/**
	 * The level of a node is a number that indicates its position in the graph.
	 *
	 * @example
	 *
	 * ```ts
	 * const sortNodeIdsByLevel = (
	 *   nodeIds: DflowNode["id"][],
	 *   pipes: Pick<DflowPipe, "from" | "to">[],
	 * ): string[] => {
	 *   const levelOfNode: Record<
	 *     DflowNode["id"],
	 *     ReturnType<typeof DflowGraph.levelOfNode>
	 *   > = {}
	 *   for (const nodeId of nodeIds) {
	 *     levelOfNode[nodeId] = DflowGraph.levelOfNode(nodeId, pipes)
	 *   }
	 *   return nodeIds.slice().sort((nodeIdA, nodeIdB) =>
	 *     (levelOfNode[nodeIdA]) <= levelOfNode[nodeIdB] ? -1 : 1
	 *   )
	 * }
	 * ```
	 */
	static levelOfNode(
		nodeId: DflowNode["id"],
		pipes: Pick<DflowPipe, "from" | "to">[],
	): number {
		const parentsNodeIds = DflowGraph.parentNodeIds(nodeId, pipes)
		// 1. A node with no parent as level zero.
		if (parentsNodeIds.length === 0) return 0
		// 2. Otherwise its level is the max level of its parents plus one.
		let maxLevel = 0
		for (const parentNodeId of parentsNodeIds) {
			maxLevel = Math.max(
				DflowGraph.levelOfNode(parentNodeId, pipes),
				maxLevel,
			)
		}
		return maxLevel + 1
	}

	addNode(name: DflowNode["name"]): DflowNode | undefined {
		const id = generateId()
		this.insert({ nodes: [{ name, id }], pipes: [] })
		return this.nodes.get(id)
	}

	addPipe({ from, to }: Pick<DflowPipe, "from" | "to">): DflowPipe | undefined {
		const id = generateId()
		this.insert({ nodes: [], pipes: [{ id, from, to }] })
		return this.pipes.get(id)
	}

	insert({ nodes, pipes }: Pick<DflowGraphObject, "nodes" | "pipes">) {
		for (const node of nodes) {
			const nodeDefinition = this.nodeDefinitions.get(node.name)
			if (!nodeDefinition) {
				continue
			}
			this.nodes.set(node.id, new DflowNode(nodeDefinition, node.id))
		}

		for (const { id, from, to } of pipes) {
			const { sourceNodeId, sourcePosition } = typeof from === "string"
				? { sourceNodeId: from, sourcePosition: 0 }
				: { sourceNodeId: from[0], sourcePosition: from[1] }
			const sourceNode = this.nodes.get(sourceNodeId)
			if (!sourceNode) {
				continue
			}
			const sourceNodeDefinition = this.nodeDefinitions.get(sourceNode.name)
			if (!sourceNodeDefinition) {
				continue
			}
			const sourceOutDefinition = sourceNodeDefinition.outs?.[sourcePosition]
			if (!sourceOutDefinition) {
				continue
			}

			const { targetNodeId, targetPosition } = typeof to === "string"
				? { targetNodeId: to, targetPosition: 0 }
				: { targetNodeId: to[0], targetPosition: to[1] }
			const targetNode = this.nodes.get(targetNodeId)
			if (!targetNode) {
				continue
			}
			const targetNodeDefinition = this.nodeDefinitions.get(targetNode.name)
			if (!targetNodeDefinition) {
				continue
			}
			const targetOutDefinition = targetNodeDefinition.ins?.[targetPosition]
			if (!targetOutDefinition) {
				continue
			}

			const targetIn = targetNode.ins[targetPosition]
			if (!targetIn) {
				continue
			}
			const pipe = new DflowPipe({ id, from, to })
			this.pipes.set(id, new DflowPipe(pipe))
			targetIn.connect(pipe)
		}
	}

	addNodeDefinitions(nodeDefinitions: DflowNodeDefinition[]) {
		for (const nodeDefinition of nodeDefinitions) {
			this.nodeDefinitions.set(nodeDefinition.name, nodeDefinition)
		}
	}

	toObject(): DflowGraphObject {
		const nodes: DflowGraphObject["nodes"] = []
		for (const node of this.nodes.values()) {
			nodes.push(node.toObject())
		}

		const pipes: DflowGraphObject["pipes"] = []
		for (const pipe of this.pipes.values()) {
			pipes.push(pipe.toObject())
		}

		return {
			nodes,
			pipes,
			nodeDefinitions: Array.from(this.nodeDefinitions.values()),
		}
	}
}

type DflowNodeModuleObject = Pick<DflowNodeModule, "id" | "name">

type DflowNodeModuleDefinition = {
	name: DflowNodeModule["name"]
	ins?: DflowInObject[]
	outs?: DflowOutObject[]
	nodes: DflowNodeObject[]
	pipes: DflowPipeObject[]
	nodeDefinitions: DflowNodeDefinition[]
}

export class DflowNodeModule implements DflowNodeInstance {
	id: string
	name: string
	ins: DflowIn[]
	outs: DflowOut[]
	node: DflowNode
	graph: DflowGraph

	constructor(
		{
			name,
			ins,
			outs,
			nodeDefinitions,
			nodes,
			pipes,
		}: DflowNodeModuleDefinition,
		id = generateId(),
	) {
		this.name = name
		const node = new DflowNode({ name, ins, outs }, id)
		this.id = node.id
		this.node = node
		this.outs = node.outs
		this.ins = node.ins

		const graph = new DflowGraph()
		graph.addNodeDefinitions(nodeDefinitions)
		graph.insert({ nodes, pipes })
		this.graph = graph
	}

	toObject(): DflowNodeModuleObject {
		return { ...this.node.toObject(), ...this.graph.toObject() }
	}
}

type DflowExecutorObject = {
	className: string
} & Pick<DflowExecutor, "status">

export type DflowExecutor = {
	status: "initialized" | "running" | "idle"
	graph: DflowGraph
	start(): void
	stop(): void
	toObject(): DflowExecutorObject
}
