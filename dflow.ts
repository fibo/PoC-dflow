type DflowID = string
type DflowName = string
type NonNegativeInteger = number

type DflowPin = DflowID | [nodeId: DflowID, position: NonNegativeInteger]

type DflowPipe = {
	from: DflowPin
	to: DflowPin
}

/**
 * Args can be
 *   - ['argName1', 'argName2', ...]
 *   - Infinity, when there are an indefinite number of arguments
 */
type DflowArgs = DflowName[] | typeof Infinity

type DflowOuts = DflowName[]

type DflowNode = {
	name: DflowName
	args?: DflowArgs
}

type DflowNodeFunction = DflowNode & { fun: string | string[] }

type DflowGraph = {
	nodes: {
		id: DflowID
		name: DflowName
	}[]
	pipes: DflowPipe[]
}

type DflowModule =
	& DflowNode
	& DflowGraph
	& {
		outs?: DflowOuts
	}

export class Dflow implements DflowModule {
	name: DflowName
	args?: DflowArgs
	outs?: DflowOuts

	nodesMap = new Map<DflowID, DflowName>()
	functionsMap = new Map<
		DflowName,
		| typeof Dflow.Function
		| typeof Dflow.AsyncFunction
		| typeof Dflow.GeneratorFunction
	>()
	pipesSet = new Set<DflowPipe>()
	argsMap = new Map<DflowName, DflowArgs>()
	outsMap = new Map<DflowName, DflowOuts>()
	graphsMap = new Map<DflowName, DflowGraph>()

	constructor(mod?: DflowModule) {
		this.name = mod?.name ?? "root"
		if (mod) {
			this.args = mod.args
			this.outs = mod.outs
		}
	}

	toValue(): DflowModule {
		return {
			name: this.name,
			args: this.args,
			outs: this.outs,
			...this.graph,
		}
	}

	static nodeFunctionBody(arg: DflowNodeFunction["fun"]) {
		return typeof arg === "string" ? arg : arg.join(";")
	}

	// static looksLikeAsyncGenerator(fun: DflowNodeFunction["fun"]) {
	// 	return fun.includes("await") && fun.includes("yield")
	// }

	static looksLikeAsyncFunction(fun: DflowNodeFunction["fun"]) {
		return fun.includes("await") && !fun.includes("yield")
	}

	// static looksLikeGenerator(fun: DflowNodeFunction["fun"]) {
	// 	return !fun.includes("await") && fun.includes("yield")
	// }

	get nodes(): DflowGraph["nodes"] {
		return Array.from(this.nodesMap.entries()).map(([id, name]) => ({
			id,
			name,
		}))
	}

	get pipes(): DflowGraph["pipes"] {
		return Array.from(this.pipesSet.values())
	}

	get graph(): DflowGraph {
		return {
			nodes: this.nodes,
			pipes: this.pipes,
		}
	}

	static parentNodeIds(nodeId: DflowID, pipes: DflowPipe[]): DflowID[] {
		return pipes
			.filter(({ to }) =>
				typeof to === "string" ? to === nodeId : to[0] === nodeId
			)
			.map(({ from }) => (typeof from === "string" ? from : from[0]))
	}

	static generateId(): DflowID {
		return crypto.randomUUID().substring(0, 8)
	}

	/**
	 * The level of a node is a number that indicates its position in the graph.
	 *
	 * @example
	 *
	 * ```ts
	 * const sortNodeIdsByLevel = (
	 *   nodeIds: DflowID[],
	 *   pipes: DflowPipe[],
	 * ): DflowID[] => {
	 *   const levelOfNode: Record<
	 *     DflowID,
	 *     ReturnType<typeof Dflow.levelOfNode>
	 *   > = {}
	 *   for (const nodeId of nodeIds) {
	 *     levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes)
	 *   }
	 *   return nodeIds.slice().sort((nodeIdA, nodeIdB) =>
	 *     (levelOfNode[nodeIdA]) <= levelOfNode[nodeIdB] ? -1 : 1
	 *   )
	 * }
	 * ```
	 */
	static levelOfNode(nodeId: DflowID, pipes: DflowPipe[]): NonNegativeInteger {
		const parentsNodeIds = Dflow.parentNodeIds(nodeId, pipes)
		// 1. A node with no parent as level zero.
		if (parentsNodeIds.length === 0) return 0
		// 2. Otherwise its level is the max level of its parents plus one.
		let maxLevel = 0
		for (const parentNodeId of parentsNodeIds) {
			maxLevel = Math.max(Dflow.levelOfNode(parentNodeId, pipes), maxLevel)
		}
		// TODO in un Directed Cyclic Graph il level è finito
		// devo controllare se i nodeId si vedono più di una volta, allora è un ciclo
		// in quel caso ritorno level Infinity
		return maxLevel + 1
	}

	addNode(name: DflowNode["name"], id = Dflow.generateId()): DflowID {
		this.insert({ nodes: [{ name, id }], pipes: [] })
		return id
	}

	addPipe({ from, to }: DflowPipe) {
		this.insert({ nodes: [], pipes: [{ from, to }] })
	}

	static nodeIdOfPin(pin: DflowPin): DflowID {
		return typeof pin === "string" ? pin : pin[0]
	}

	static positionOfPin(pin: DflowPin): NonNegativeInteger | undefined {
		return typeof pin === "string" ? undefined : pin[1]
	}

	static nodeIdsOfPipe({
		from: source,
		to: target,
	}: DflowPipe): [sourceId: DflowID, targetId: DflowID] {
		return [Dflow.nodeIdOfPin(source), Dflow.nodeIdOfPin(target)]
	}

	insert({ nodes, pipes }: DflowGraph) {
		for (const node of nodes) {
			this.nodesMap.set(node.id, node.name)
		}
		for (const pipe of pipes) {
			const [sourceId, targetId] = Dflow.nodeIdsOfPipe(pipe)
			if (this.nodesMap.has(sourceId) && this.nodesMap.has(targetId)) {
				this.pipesSet.add(pipe)
			}
		}
	}

	setFunction({ name, args, fun }: DflowNodeFunction) {
		if (args) this.argsMap.set(name, args)
		if (Dflow.looksLikeAsyncFunction(fun)) {
			if (Array.isArray(args)) {
				this.functionsMap.set(
					name,
					Dflow.AsyncFunction(...args, Dflow.nodeFunctionBody(fun)),
				)
			} else {
				this.functionsMap.set(
					name,
					Dflow.AsyncFunction(Dflow.nodeFunctionBody(fun)),
				)
			}
		} else {
			if (Array.isArray(args)) {
				this.functionsMap.set(
					name,
					Dflow.Function(...args, Dflow.nodeFunctionBody(fun)),
				)
			} else {
				this.functionsMap.set(
					name,
					Dflow.Function(Dflow.nodeFunctionBody(fun)),
				)
			}
		}
	}

	registerModule({ name, args, outs, nodes, pipes }: DflowModule) {
		if (args) this.argsMap.set(name, args)
		if (outs) this.outsMap.set(name, outs)
		this.graphsMap.set(name, { nodes, pipes })
	}

	static Function = function () {}.constructor

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
	static AsyncFunction = async function () {}.constructor

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/GeneratorFunction/GeneratorFunction
	static GeneratorFunction = function* () {}.constructor

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGeneratorFunction
	static AsyncGeneratorFunction = async function* () {}.constructor
}
