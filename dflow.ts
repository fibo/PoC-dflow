const generateId = () => {
	return crypto.randomUUID().substring(0, 8)
}

type DflowInObject = Pick<DflowIn, "name">

class DflowIn {
	name: string

	constructor({ name }: DflowInObject) {
		this.name = name
	}

	toObject(): DflowInObject {
		return { name: this.name }
	}
}

type DflowOutObject = Pick<DflowOut, "name">

class DflowOut {
	name: string

	constructor({ name }: DflowOutObject) {
		this.name = name
	}

	toObject(): DflowOutObject {
		return { name: this.name }
	}
}

type DflowPipeObject = Pick<DflowPipe, "id" | "from" | "to">

class DflowPipe {
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

type DflowNodeDefinition = Pick<DflowNode, "name" | "fun"> & {
	ins?: DflowInObject[]
	outs?: DflowOutObject[]
}

type DflowNodeInstance = {
	id: string
	ins: DflowIn[]
	outs: DflowIn[]
}

class DflowNode implements DflowNodeInstance {
	id: string
	name: string
	ins: DflowIn[]
	outs: DflowOut[]

	fun: string | string[]

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

type DflowGraphObject = {
	nodes: DflowNodeObject[]
	pipes: DflowPipeObject[]
}

export class DflowGraph {
	nodes = new Map<DflowNode["id"], DflowNode>()
	pipes = new Map<DflowPipe["id"], DflowPipe>()
	nodeDefinitions = new Map<DflowNodeDefinition["name"], DflowNodeDefinition>()

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

	insert({ nodes, pipes }: DflowGraphObject) {
		for (const node of nodes) {
			const nodeDefinition = this.nodeDefinitions.get(node.name)
			if (!nodeDefinition) {
				continue
			}
			this.nodes.set(node.id, new DflowNode(nodeDefinition, node.id))
		}

		for (const pipe of pipes) {
			const { from, to } = pipe

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

			this.pipes.set(pipe.id, new DflowPipe(pipe))
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
		}
	}
}
