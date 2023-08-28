export declare namespace Dflow {
	/** A Dflow.Func is a function, an async function, a generator or an async generator */
	export type Func = DflowFunc

	export type Name = string

	/** Dflow.Args is a list of argument names */
	export type Args = Dflow.Name[]

	/** A Dflow.Node is a base type for an executable unit: for example a function */
	export type Node = {
		name: Dflow.Name
		args?: Dflow.Args
	}

	/** A Dflow.Code can hold one or more lines of JavaScript code */
	export type Code = string | string[]

	/** A Dflow.NodeFunc is a node with some code. */
	export type NodeFunc = Dflow.Node & { code: Dflow.Code }

	/** A Dflow.NodeId is a node identifier */
	export type NodeId = string

	/** A Dflow.Pin can be an input or an output of a node */
	export type Pin = Dflow.NodeId | [nodeId: Dflow.NodeId, position: number]

	/** Stringified Dflow.Pin */
	export type PinId = Dflow.NodeId | `${Dflow.NodeId},${number}`

	/** A Dflow.Pipe connects from a source Dflow.Pin to a target Dflow.Pin */
	export type Pipe = {
		from: Dflow.Pin
		to: Dflow.Pin
	}

	/** A Dflow.Graph is a collection of nodes and pipes */
	export type Graph = {
		nodes: {
			id: Dflow.NodeId
			name: Dflow.Name
		}[]
		pipes: Dflow.Pipe[]
	}

	/** A Dflow.Outs is a list of one or more declared outputs for a node */
	export type Outs = Dflow.Name[]

	export type NodeGraph =
		& Dflow.Node
		& Dflow.Graph
		& {
			outs?: Dflow.Outs
		}

	/** Dflow.GraphInstanceMap is a generic util to define a map of sub-graph instances */
	export type GraphInstanceMap<T extends Dflow> = Map<Dflow.NodeId, T>
}

type DflowFunc =
	| typeof Dflow.AsyncFunc
	| typeof Dflow.AsyncGeneratorFunc
	| typeof Dflow.Func
	| typeof Dflow.GeneratorFunc

export class Dflow implements Dflow.NodeGraph {
	name: Dflow.Name
	args?: Dflow.Args
	outs?: Dflow.Outs

	argNodeNames = new Set<Dflow.Name>()

	funcByName = new Map<Dflow.Name, Dflow.Func>()

	/**
	 * A context to bound the Dflow.Func execution.
	 *   - key: Func name
	 *   - value: context, if any
	 */
	funcContext = new Map<Dflow.Name, unknown>()

	graphByName = new Map<Dflow.Name, Dflow.Graph>()

	/**
	 * A map of Dflow sub-graph instances.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   // Override graphInstanceById to get the proper instance type.
	 *   graphInstanceById: Dflow.GraphInstanceMap<MyDflow> = new Map();
	 *
	 *   // Add a sub-graph with same instance of same class.
	 *   addSubGraph(graph: Dflow.NodeGraph, id = Dflow.generateNodeId()) {
	 *     const subGraph = new MyDflow(graph);
	 *     subGraph.inheritFuncs({
	 *       // Notice that maps are cloned.
	 *       funcByName: new Map(this.funcByName),
	 *       funcContext: new Map(this.funcContext),
	 *       nodeArgsByName: new Map(this.nodeArgsByName),
	 *     });
	 *     this.graphInstanceById.set(id, subGraph);
	 *   }
	 * }
	 * ```
	 */
	graphInstanceById: Dflow.GraphInstanceMap<Dflow> = new Map()

	nodeArgsByName = new Map<Dflow.Name, Dflow.Args>()

	nodeNameById = new Map<Dflow.NodeId, Dflow.Name>()

	nodeOutsByName = new Map<Dflow.Name, Dflow.Outs>()

	outNodeNames = new Set<Dflow.Name>()

	outsData: Map<Dflow.PinId, unknown>

	/**
	 * Map of pipes.
	 *  - key=targetId, pipe.to
	 *  - value=sourceId, pipe.from
	 */
	pipesMap = new Map<Dflow.PinId, Dflow.PinId>()

	constructor(
		{ name, args, outs, nodes, pipes }: Dflow.NodeGraph = {
			name: "dflow",
			nodes: [],
			pipes: [],
		},
	) {
		this.name = name

		if (args) for (const arg of args) this.setNode({ name: arg })
		this.args = args

		if (outs) {
			for (const out of outs) this.setNode({ name: out, args: ["out"] })
		}
		this.outs = outs

		this.outsData = new Map()

		this.insert({ nodes, pipes })
	}

	get data() {
		return Object.fromEntries(this.outsData.entries())
	}

	get graph(): Dflow.Graph {
		return {
			nodes: this.nodes,
			pipes: this.pipes,
		}
	}

	/**
	 * A Dflow has async nodes if some of its DflowFunc is async or if some of its sub-graphs is async.
	 */
	get hasAsyncNodes() {
		const seenNodeName = new Set()
		for (const [nodeId, nodeName] of this.nodeNameById.entries()) {
			// 1. Check sub-graph instances (by nodeId) first.
			const graph = this.graphInstanceById.get(nodeId)
			if (graph?.hasAsyncNodes) return true

			// 2. Then check DflowFunc (by nodeName).
			if (seenNodeName.has(nodeName)) {
				// Avoid double checking.
				continue
			}
			seenNodeName.add(nodeName)
			const func = this.funcByName.get(nodeName)
			if (func) {
				if (Dflow.isAsyncFunc(func) || Dflow.isAsyncGeneratorFunc(func)) {
					return true
				}
			}
		}
		return false
	}

	get nodeIds(): Dflow.NodeId[] {
		return Array.from(this.nodeNameById.keys())
	}

	get nodes(): Dflow.Graph["nodes"] {
		return Array.from(this.nodeNameById.entries(), ([id, name]) => ({
			id,
			name,
		}))
	}

	get pipes(): Dflow.Graph["pipes"] {
		return Array.from(this.pipesMap.entries(), ([toId, fromId]) => ({
			from: Dflow.idToPin(fromId),
			to: Dflow.idToPin(toId),
		}))
	}

	addNode(name: Dflow.Node["name"], id = Dflow.generateNodeId()): Dflow.NodeId {
		this.nodeNameById.set(id, name)
		return id
	}

	addPipe(pipe: Dflow.Pipe) {
		if (this.isBrokenPipe(pipe)) {
			throw new Dflow.Error.BrokenPipe(pipe)
		} else {
			this.pipesMap.set(Dflow.pinToPinId(pipe.to), Dflow.pinToPinId(pipe.from))
		}
	}

	insert({ nodes, pipes }: Dflow.Graph) {
		for (const node of nodes) {
			this.addNode(node.name, node.id)
		}
		for (const pipe of pipes) {
			this.addPipe(pipe)
		}
	}

	hasNode(name: Dflow.Name) {
		return (
			this.argNodeNames.has(name) ||
			this.outNodeNames.has(name) ||
			this.funcByName.has(name) ||
			this.graphByName.has(name)
		)
	}

	/**
	 * Inherits funcs; do not override this args and outs.
	 */
	inheritFuncs({
		funcByName,
		funcContext,
		nodeArgsByName,
	}: Pick<Dflow, "funcByName" | "funcContext" | "nodeArgsByName">) {
		for (const [funcName, func] of funcByName.entries()) {
			if (
				!(this.args ?? []).includes(funcName) &&
				!(this.outs ?? []).includes(funcName) &&
				func
			) {
				const funcArgs = nodeArgsByName.get(funcName)
				if (funcArgs) {
					this.nodeArgsByName.set(funcName, funcArgs)
				}
				const context = funcContext.get(funcName)
				if (context) this.funcContext.set(funcName, context)
				this.funcByName.set(funcName, func)
			}
		}
	}

	isBrokenPipe(pipe: Dflow.Pipe) {
		const [sourceId, targetId] = Dflow.nodeIdsOfPipe(pipe)
		return !this.nodeNameById.has(sourceId) || !this.nodeNameById.has(targetId)
	}

	pipesOfSourceId(sourceId: Dflow.PinId): Dflow.Pipe[] {
		const pipes: Dflow.Pipe[] = []
		for (const [toId, fromId] of this.pipesMap.entries()) {
			if (fromId === sourceId) {
				pipes.push({
					from: Dflow.idToPin(fromId),
					to: Dflow.idToPin(toId),
				})
			}
		}
		return pipes
	}

	pipeOfTargetId(targetId: Dflow.PinId): Dflow.Pipe | undefined {
		for (const [toId, fromId] of this.pipesMap.entries()) {
			if (toId === targetId) {
				return {
					from: Dflow.idToPin(fromId),
					to: Dflow.idToPin(toId),
				}
			}
		}
	}

	setFunc(name: Dflow.Name, func: Dflow.Func, args?: Dflow.Args) {
		this.setNode({ name, args })
		if (this.hasNode(name)) {
			throw new Dflow.Error.NodeOverride(name)
		}
		if (args) this.nodeArgsByName.set(name, args)
		this.funcByName.set(name, func)
	}

	setNode({ name, args }: Dflow.Node) {
		if (this.hasNode(name)) {
			throw new Dflow.Error.NodeOverride(name)
		}
		if (args) this.nodeArgsByName.set(name, args)
	}

	setNodeFunc({ name, args, code }: Dflow.NodeFunc) {
		this.setNode({ name, args })
		if (Dflow.looksLikeAsyncCode(code)) {
			if (args) {
				this.setFunc(
					name,
					Dflow.AsyncFunc(...args, Dflow.funcBody(code)),
					args,
				)
			} else {
				this.setFunc(name, Dflow.AsyncFunc(Dflow.funcBody(code)))
			}
		} else {
			if (args) {
				this.setFunc(name, Dflow.Func(...args, Dflow.funcBody(code)))
			} else {
				this.setFunc(name, Dflow.Func(Dflow.funcBody(code)))
			}
		}
	}

	setNodeGraph({ name, args, outs, nodes, pipes }: Dflow.NodeGraph) {
		this.setNode({ name, args })
		if (outs) this.nodeOutsByName.set(name, outs)
		this.graphByName.set(name, { nodes, pipes })
	}

	toJSON() {
		return this.toValue()
	}

	toValue(): Dflow.NodeGraph {
		return {
			name: this.name,
			args: this.args,
			outs: this.outs,
			...this.graph,
		}
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
	static AsyncFunc = async function () {}.constructor

	static Func = function () {}.constructor

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/GeneratorFunction/GeneratorFunction
	static GeneratorFunc = function* () {}.constructor

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGeneratorFunction
	static AsyncGeneratorFunc = async function* () {}.constructor

	static funcBody(arg: Dflow.Code) {
		return typeof arg === "string" ? arg : arg.join(";")
	}

	static generateNodeId(): Dflow.NodeId {
		return crypto.randomUUID().substring(0, 8)
	}

	static idToPin(id: Dflow.PinId): Dflow.Pin {
		const [nodeId, positionStr] = id.split(",")
		const position = Number(positionStr)
		return position ? [nodeId, position] : nodeId
	}

	/**
	 * The level of a node is a number that indicates its position in the graph.
	 *
	 * @example
	 *
	 * ```ts
	 * const nodeIdsSortedByLevel = (
	 *   nodeIds: Dflow.NodeId[],
	 *   pipes: Dflow.Pipe[],
	 * ): DflowId[] => {
	 *   const levelOfNode: Record<Dflow.NodeId, number> = {}
	 *   for (const nodeId of nodeIds) {
	 *     levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes)
	 *   }
	 *   return nodeIds.slice().sort((nodeIdA, nodeIdB) =>
	 *     (levelOfNode[nodeIdA]) <= levelOfNode[nodeIdB] ? -1 : 1
	 *   )
	 * }
	 * ```
	 */
	static levelOfNode(nodeId: Dflow.NodeId, pipes: Dflow.Pipe[]): number {
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
		//
		// oppure posso anche ritornare level -1 se è un generator, in quel caso sarebbe da gestire
		return maxLevel + 1
	}

	static isAsyncFunc(func: unknown) {
		return func?.constructor === Dflow.AsyncFunc
	}

	static isAsyncGeneratorFunc(func: unknown) {
		return func?.constructor === Dflow.AsyncGeneratorFunc
	}

	static isFunc(func: unknown) {
		return func?.constructor === Dflow.Func
	}

	static isGeneratorFunc(func: unknown) {
		return func?.constructor === Dflow.GeneratorFunc
	}

	static looksLikeAsyncGeneratorCode(arg: Dflow.Code) {
		return arg.includes("await") && arg.includes("yield")
	}

	static looksLikeAsyncCode(arg: Dflow.Code) {
		return arg.includes("await") && !arg.includes("yield")
	}

	static looksLikeGeneratorCode(arg: Dflow.Code) {
		return !arg.includes("await") && arg.includes("yield")
	}

	static nodeIdOfPin(pin: Dflow.Pin): Dflow.NodeId {
		return typeof pin === "string" ? pin : pin[0]
	}

	static nodeIdsOfPipe({
		from,
		to,
	}: Dflow.Pipe): [sourceNodeId: Dflow.NodeId, targetNodeId: Dflow.NodeId] {
		return [Dflow.nodeIdOfPin(from), Dflow.nodeIdOfPin(to)]
	}

	static parentNodeIds(
		nodeId: Dflow.NodeId,
		pipes: Dflow.Pipe[],
	): Dflow.NodeId[] {
		return pipes
			.filter(({ to }) => Dflow.nodeIdOfPin(to) === nodeId)
			.map(({ from }) => Dflow.nodeIdOfPin(from))
	}

	static pinToPinId(pin: Dflow.Pin): Dflow.PinId {
		return typeof pin === "string" ? pin : pin[1] === 0 ? pin[0] : pin.join()
	}

	static positionOfPin(pin: Dflow.Pin): number | undefined {
		return typeof pin === "string" ? undefined : pin[1]
	}

	static Error = {
		BrokenPipe: class DflowErrorBrokenPipe extends Error {
			pipe: Dflow.Pipe
			constructor(pipe: Dflow.Pipe) {
				super(DflowErrorBrokenPipe.message(pipe))
				this.pipe = pipe
			}
			toJSON() {
				return this.toValue()
			}
			toValue() {
				return {
					errorName: "DflowErrorBrokenPipe",
					pipe: this.pipe,
				}
			}
			static message(pipe: Dflow.Pipe) {
				return `Broken DflowPipe from=${pipe.from} to=${pipe.to}`
			}
		},

		NodeExecution: class DflowErrorNodeExecution extends Error {
			nodeErrorMessage: Error["message"]
			nodeId: Dflow.NodeId
			nodeName: Dflow.Node["name"]
			constructor(
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			) {
				super(
					DflowErrorNodeExecution.message(nodeId, nodeName, nodeErrorMessage),
				)
				this.nodeId = nodeId
				this.nodeName = nodeName
				this.nodeErrorMessage = nodeErrorMessage
			}
			toJSON() {
				return this.toValue()
			}
			toValue() {
				return {
					errorName: "DflowErrorNodeExecution",
					nodeId: this.nodeId,
					nodeName: this.nodeName,
					nodeErrorMessage: this.nodeErrorMessage,
				}
			}
			static message(
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			) {
				return `Execution error on DflowNode name=${nodeName} id=${nodeId} error.message=${nodeErrorMessage}`
			}
		},

		NodeOverride: class DflowErrorNodeOverride extends Error {
			nodeName: Dflow.Node["name"]
			constructor(name: Dflow.Node["name"]) {
				super(DflowErrorNodeOverride.message(name))
				this.nodeName = name
			}
			toJSON() {
				return this.toValue()
			}
			toValue() {
				return {
					errorName: "DflowErrorNodeOverride",
					nodeName: this.nodeName,
				}
			}
			static message(name: Dflow.Node["name"]) {
				return `Cannot override existing DflowNode name=${name}`
			}
		},
	}
}
