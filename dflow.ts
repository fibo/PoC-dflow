/** https://github.com/fibo/dflow @license MIT */
export declare namespace Dflow {
	/** A Dflow.Func is a function, an async function, a generator or an async generator */
	export type Func = DflowFunc;

	export type Name = string;

	/** Dflow.Args is a list of argument names */
	export type Args = Dflow.Name[];

	/** A Dflow.Node is a base type for an executable unit: for example a function */
	export type Node = {
		name: Dflow.Name;
		args?: Dflow.Args;
	};

	/** A Dflow.Code can hold one or more lines of JavaScript code */
	export type Code = string | string[];

	/** A Dflow.NodeFunc is a node with some code. */
	export type NodeFunc = Dflow.Node & { code: Dflow.Code };

	/**
	 * A Dflow.NodeId is a node identifier.
	 *
	 * The id generation is not provided by Dflow,
	 * but is supposed that ids does not contain commas.
	 */
	export type NodeId = string;

	/** A Dflow.Pin can be an input or an output of a node */
	export type Pin = Dflow.NodeId | [nodeId: Dflow.NodeId, position: number];

	/**
	 * A Dflow.PinId is composed by a Dflow.NodeId and pin position;
	 * if position is zero, it is omitted.
	 */
	export type PinId = Dflow.NodeId | `${Dflow.NodeId},${number}`;

	/** A Dflow.Pipe connects from a Dflow.Pin to a Dflow.Pin */
	export type Pipe = {
		from: Dflow.Pin;
		to: Dflow.Pin;
	};

	export type PipeId = [to: Dflow.PinId, from: Dflow.PinId];

	/** A Dflow.Graph is a collection of nodes and pipes */
	export type Graph = {
		nodes: {
			id: Dflow.NodeId;
			name: Dflow.Name;
		}[];
		pipes: Dflow.Pipe[];
	};

	/** A Dflow.Outs is a list of one or more declared outputs for a node */
	export type Outs = Dflow.Name[];

	export type NodeGraph = Dflow.Node &
		Dflow.Graph & {
			outs?: Dflow.Outs;
		};
}

type DflowFunc =
	| typeof Dflow.AsyncFunc
	| typeof Dflow.AsyncGeneratorFunc
	| typeof Dflow.Func
	| typeof Dflow.GeneratorFunc;

export class Dflow {
	name: Dflow.Name;
	args?: Dflow.Args;
	outs?: Dflow.Outs;

	/**
	 * A context to bound the Dflow.Func execution.
	 *   - key: func name
	 *   - value: context, if any
	 */
	context = new Map<Dflow.Name, unknown>();

	func = new Map<Dflow.Name, Dflow.Func>();

	/**
	 * Graph instances.
	 *
	 * If you access it in a child class you may need to override it.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   // Override graph Map to get the proper instance type.
	 *   graph = new Map<Dflow.NodeId, MyDflow>();
	 * }
	 * ```
	 */
	graph = new Map<Dflow.NodeId, Dflow>();

	/** Names of nodes that correspond to args and outs. */
	ioNodes = new Set<Dflow.Name>();

	/**
	 * Node instances.
	 *   - key: node id
	 *   - value: node name
	 *
	 * @example
	 * ```ts
	 * const nodeIds = Array.from(this.node.keys())
	 * ```
	 *
	 * @example
	 * ```ts
	 * const nodes: Dflow.Graph["nodes"] = Array.from(
	 *   this.node.entries(), ([id, name]) => ({ id, name })
	 * )
	 * ```
	 */
	node = new Map<Dflow.NodeId, Dflow.Name>();

	nodeArgs = new Map<Dflow.Name, Dflow.Args>();

	nodeGraph = new Map<Dflow.Name, Dflow.NodeGraph>();

	/**
	 * Node output names.
	 */
	nodeOuts = new Map<Dflow.Name, Dflow.Outs>();

	/**
	 * Every output data.
	 *   - key: pinId, of the related output
	 *   - value: data
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   get data() {
	 *     return Object.fromEntries(this.out.entries());
	 *   }
	 * }
	 * ```
	 */
	out = new Map<Dflow.PinId, unknown>();

	/**
	 * Pipe instances.
	 *  - key: target pinId, pipe.to
	 *  - value: source pinId, pipe.from
	 *
	 * @example
	 * ```ts
	 * const pipes: Dflow.Graph["pipes"] = Array.from(
	 *   this.pipe.values(), Dflow.pipeIdToPipe
	 * )
	 * ```
	 */
	pipe = new Map<Dflow.PinId, Dflow.PinId>();

	constructor(
		{ name, args, outs, nodes, pipes }: Dflow.NodeGraph = {
			name: "",
			nodes: [],
			pipes: [],
		},
	) {
		this.name = name;

		if (args) for (const arg of args) this.setNodeArg(arg);
		this.args = args;

		if (outs) for (const out of outs) this.setNodeOut(out);
		this.outs = outs;

		this.insert({ nodes, pipes });
	}

	/**
	 * Nodes sorted by level.
	 */
	get nodes(): [nodeId: Dflow.NodeId, nodeName: Dflow.Name][] {
		const pipes = Array.from(this.pipe.entries(), Dflow.pipeIdToPipe);
		const levelOfNode: Record<Dflow.NodeId, number> = {};
		const nodes = Array.from(this.node.entries());
		for (const [nodeId] of nodes) {
			levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes);
		}
		return nodes.sort(([nodeIdA], [nodeIdB]) =>
			levelOfNode[nodeIdA] <= levelOfNode[nodeIdB] ? -1 : 1,
		);
	}

	/**
	 * Add a node graph instance.
	 */
	addNodeGraph(
		nodeId: Dflow.NodeId,
		nodeGraph: Dflow.NodeGraph | undefined = undefined,
	) {
		if (!nodeGraph) return;
		if (this.graph.has(nodeId)) return;
		const graph = new Dflow(nodeGraph);
		graph.inherit(this);
		this.graph.set(nodeId, graph);
	}

	/**
	 * Add a node instance.
	 *
	 * You may want to override this method to provide an id by default.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   addNode(name: Dflow.Node["name"], id = crypto.randomUUID()): Dflow.NodeId {
	 *     this.node.set(id, name);
	 *     return id;
	 *   }
	 * }
	 * ```
	 */
	addNode(name: Dflow.Node["name"], id: Dflow.NodeId): Dflow.NodeId {
		this.node.set(id, name);
		return id;
	}

	/**
	 * Connect from a node output to a node input.
	 */
	addPipe(pipe: Dflow.Pipe) {
		if (Dflow.isBrokenPipe(pipe, this.node))
			throw new Dflow.Error.BrokenPipe(pipe);
		this.pipe.set(Dflow.pinToPinId(pipe.to), Dflow.pinToPinId(pipe.from));
	}

	delNode(nodeId: Dflow.NodeId) {
		this.delete({ nodes: [{ id: nodeId }], pipes: [] });
	}

	delPipe({ to }: Pick<Dflow.Pipe, "to">) {
		this.pipe.delete(Dflow.pinToPinId(to));
	}

	argValues(nodeId: Dflow.NodeId) {
		const values: unknown[] = [];

		const nodeName = this.node.get(nodeId);
		if (!nodeName) throw new Dflow.Error.NodeNotFound(nodeId);

		const argNames = this.nodeArgs.get(nodeName);

		if (!argNames) return values;
		for (let position = 0; position < argNames.length; position++) {
			const source = this.pipe.get(Dflow.pinToPinId([nodeId, position]));
			if (source) {
				values.push(this.out.get(Dflow.pinToPinId(source)));
			} else {
				values.push(undefined);
			}
		}

		return values;
	}

	/**
	 * Delete nodes and pipes from graph.
	 *
	 * When a node is deleted, also the pipes that are connected are deleted.
	 * Return deleted item ids.
	 */
	delete({
		nodes = [],
		pipes = [],
	}: Pick<Dflow.Graph, "pipes"> &
		Partial<{
			nodes: { id: Dflow.NodeId }[];
			pipes: { to: Dflow.Pin }[];
		}>) {
		const deleted: Dflow.Graph = { nodes: [], pipes: [] };
		const deletedNodeIds = new Set<Dflow.NodeId>();
		const pipesOfDeletedNodes: { to: Dflow.Pin }[] = [];

		for (const { id } of nodes) {
			const name = this.node.get(id);
			if (name) {
				deleted.nodes.push({ id, name });
				this.node.delete(id);
				deletedNodeIds.add(id);
			}
		}
		// Collect pipes that were connected to deleted nodes.
		for (const [toId, fromId] of this.pipe.entries())
			if (
				deletedNodeIds.has(Dflow.nodeIdOfPin(toId)) ||
				deletedNodeIds.has(Dflow.nodeIdOfPin(fromId))
			)
				pipesOfDeletedNodes.push({ to: Dflow.pinIdToPin(toId) });
		// Delete wanted pipes plus pipes that are broken after nodes deletion.
		for (const { to } of pipes.concat(pipesOfDeletedNodes)) {
			const toId = Dflow.pinToPinId(to);
			const from = this.pipe.get(toId);
			if (from) {
				deleted.pipes.push({ from, to });
				this.pipe.delete(toId);
			}
		}

		return deleted;
	}

	hasNode(name: Dflow.Name) {
		return (
			this.ioNodes.has(name) ||
			this.func.has(name) ||
			this.nodeGraph.has(name)
		);
	}

	/**
	 * Inherit funcs, args and contexts; do not override this instance ioNodes.
	 */
	inherit(dflow: Pick<Dflow, "func" | "context" | "nodeArgs">) {
		for (const [funcName, func] of dflow.func.entries()) {
			if (this.ioNodes.has(funcName)) continue;
			const args = dflow.nodeArgs.get(funcName);
			if (args) this.nodeArgs.set(funcName, args);
			const context = dflow.context.get(funcName);
			if (context) this.context.set(funcName, context);
			this.func.set(funcName, func);
		}
	}

	insert({ nodes = [], pipes = [] }: Partial<Dflow.Graph>) {
		for (const node of nodes) this.addNode(node.name, node.id);
		for (const pipe of pipes) this.addPipe(pipe);
	}

	async run() {
		for (const [nodeId, nodeName] of this.nodes) {
			// If node is a graph, create a graph instance if it does not exist.
			this.addNodeGraph(nodeId, this.nodeGraph.get(nodeName));

			await this.runNode(nodeId, nodeName);
		}
	}

	async runFunc(
		nodeId: Dflow.NodeId,
		func: Dflow.Func | undefined = undefined,
		context: unknown = null,
	) {
		if (!func) return;
		const argValues = this.argValues(nodeId);
		try {
			if (Dflow.isAsyncFunc(func)) {
				const data = await func.apply(context, argValues);
				this.out.set(nodeId, data);
			} else if (Dflow.isFunc(func)) {
				const data = func.apply(context, argValues);
				this.out.set(nodeId, data);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			throw new Dflow.Error.NodeExecution(
				nodeId,
				this.node.get(nodeId) ?? "",
				message,
			);
		}
	}

	async runGraph(
		graphId: Dflow.NodeId,
		graph: Dflow | undefined = undefined,
	) {
		if (!graph) return;
		const argValues = this.argValues(graphId);
		// 1. Set graph input values.
		const argNames = graph.args;
		if (argNames) {
			for (const [nodeId, nodeName] of graph.node.entries()) {
				for (let position = 0; position < argNames.length; position++) {
					if (nodeName === argNames[position]) {
						graph.out.set(
							Dflow.pinToPinId([nodeId, position]),
							argValues[position],
						);
					}
				}
			}
		}
		// 2. Execute graph.
		try {
			await graph.run();
		} catch (error) {
			if (error instanceof Error) {
				throw new Dflow.Error.NodeExecution(
					graphId,
					this.node.get(graphId) ?? "",
					error.message,
				);
			} else {
				throw error;
			}
		}
		// 3. Get graph output values.
		const outs = graph.outs;
		if (outs)
			for (const [nodeId, nodeName] of graph.node.entries())
				for (let position = 0; position < outs.length; position++)
					if (nodeName === outs[position]) {
						const source = this.pipe.get(nodeId);
						if (source)
							this.out.set(
								Dflow.pinToPinId([graphId, position]),
								graph.out.get(Dflow.pinToPinId(source)),
							);
					}
	}

	async runNode(nodeId: Dflow.NodeId, nodeName: Dflow.Name) {
		// Run func, if any.
		await this.runFunc(
			nodeId,
			this.func.get(nodeName),
			this.context.get(nodeName),
		);

		// Run graph, if any.
		await this.runGraph(nodeId, this.graph.get(nodeName));
	}

	setFunc(name: Dflow.Name, func: Dflow.Func, args?: Dflow.Args) {
		if (this.hasNode(name)) throw new Dflow.Error.NodeOverride(name);
		if (args) {
			this.nodeArgs.set(name, args);
		} else if (func.length > 0) {
			this.nodeArgs.set(
				name,
				Array.from({ length: 2 }).map((_, i) => `arg${i}`),
			);
		}
		this.func.set(name, func);
	}

	setNodeArg(name: Dflow.Name) {
		if (this.hasNode(name)) throw new Dflow.Error.NodeOverride(name);
		this.ioNodes.add(name);
	}

	setNodeFunc({ name, args, code }: Dflow.NodeFunc) {
		if (this.hasNode(name)) throw new Dflow.Error.NodeOverride(name);
		if (Dflow.looksLikeAsyncCode(code)) {
			if (args) {
				this.setFunc(
					name,
					Dflow.AsyncFunc(...args, Dflow.funcBody(code)),
					args,
				);
				this.nodeArgs.set(name, args);
			} else {
				this.setFunc(name, Dflow.AsyncFunc(Dflow.funcBody(code)));
			}
		} else {
			if (args) {
				this.setFunc(name, Dflow.Func(...args, Dflow.funcBody(code)));
			} else {
				this.setFunc(name, Dflow.Func(Dflow.funcBody(code)));
			}
		}
	}

	setNodeGraph({ name, args, outs, nodes, pipes }: Dflow.NodeGraph) {
		if (this.hasNode(name)) throw new Dflow.Error.NodeOverride(name);
		if (args) this.nodeArgs.set(name, args);
		if (outs) this.nodeOuts.set(name, outs);
		this.nodeGraph.set(name, { name, args, outs, nodes, pipes });
	}

	setNodeOut(name: Dflow.Name) {
		if (this.hasNode(name)) throw new Dflow.Error.NodeOverride(name);
		this.nodeArgs.set(name, ["out"]);
		this.ioNodes.add(name);
	}

	toJSON() {
		return this.toValue();
	}

	toString() {
		const { name, args, nodes, pipes, outs } = this.toValue();
		return `Dflow name=${name} args=${args?.length ?? 0} nodes=${
			nodes.length
		} pipes=${pipes.length} outs=${outs?.length ?? 0}`;
	}

	toValue(): Dflow.NodeGraph {
		return {
			name: this.name,
			args: this.args,
			outs: this.outs,
			nodes: Array.from(this.node.entries(), ([id, name]) => ({
				id,
				name,
			})),
			pipes: Array.from(this.pipe.entries(), Dflow.pipeIdToPipe),
		};
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
	static AsyncFunc = async function () {}.constructor;

	static Func = function () {}.constructor;

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/GeneratorFunction/GeneratorFunction
	static GeneratorFunc = function* () {}.constructor;

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGeneratorFunction
	static AsyncGeneratorFunc = async function* () {}.constructor;

	static funcBody(arg: Dflow.Code) {
		return typeof arg === "string" ? arg : arg.join(";");
	}

	static pinIdToPin(id: Dflow.PinId): Dflow.Pin {
		const [nodeId, positionStr] = id.split(",");
		const position = Number(positionStr);
		return position ? [nodeId, position] : nodeId;
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
		const parentsNodeIds = Dflow.parentNodeIds(nodeId, pipes);
		// 1. A node with no parent as level zero.
		if (parentsNodeIds.length === 0) return 0;
		// 2. Otherwise its level is the max level of its parents plus one.
		let maxLevel = 0;
		for (const parentNodeId of parentsNodeIds) {
			maxLevel = Math.max(
				Dflow.levelOfNode(parentNodeId, pipes),
				maxLevel,
			);
		}
		// TODO in un Directed Cyclic Graph il level è finito
		// devo controllare se i nodeId si vedono più di una volta, allora è un ciclo
		// in quel caso ritorno level Infinity
		//
		// oppure posso anche ritornare level -1 se è un generator, in quel caso sarebbe da gestire
		return maxLevel + 1;
	}

	static isAsyncFunc(func: unknown) {
		return func?.constructor === Dflow.AsyncFunc;
	}

	static isAsyncGeneratorFunc(func: unknown) {
		return func?.constructor === Dflow.AsyncGeneratorFunc;
	}

	static isBrokenPipe(pipe: Dflow.Pipe, node: Dflow["node"]) {
		return Dflow.nodeIdsOfPipe(pipe).some((nodeId) => !node.has(nodeId));
	}

	static isFunc(func: unknown) {
		return func?.constructor === Dflow.Func;
	}

	static isGeneratorFunc(func: unknown) {
		return func?.constructor === Dflow.GeneratorFunc;
	}

	static looksLikeAsyncGeneratorCode(arg: Dflow.Code) {
		return arg.includes("await") && arg.includes("yield");
	}

	static looksLikeAsyncCode(arg: Dflow.Code) {
		return arg.includes("await") && !arg.includes("yield");
	}

	static looksLikeGeneratorCode(arg: Dflow.Code) {
		return !arg.includes("await") && arg.includes("yield");
	}

	static nodeIdOfPin(pin: Dflow.Pin): Dflow.NodeId {
		return typeof pin === "string" ? pin : pin[0];
	}

	static nodeIdsOfPipe({
		from,
		to,
	}: Dflow.Pipe): [source: Dflow.NodeId, target: Dflow.NodeId] {
		return [Dflow.nodeIdOfPin(from), Dflow.nodeIdOfPin(to)];
	}

	static parentNodeIds(
		nodeId: Dflow.NodeId,
		pipes: Dflow.Pipe[],
	): Dflow.NodeId[] {
		return pipes
			.filter(({ to }) => Dflow.nodeIdOfPin(to) === nodeId)
			.map(({ from }) => Dflow.nodeIdOfPin(from));
	}

	static pinToPinId(pin: Dflow.Pin): Dflow.PinId {
		return typeof pin === "string"
			? pin
			: pin[1] === 0
			? pin[0]
			: pin.join();
	}

	static pipeIdToPipe([to, from]: Dflow.PipeId): Dflow.Pipe {
		return {
			from: Dflow.pinIdToPin(from),
			to: Dflow.pinIdToPin(to),
		};
	}

	static Error = {
		BrokenPipe: class DflowErrorBrokenPipe extends Error {
			pipe: Dflow.Pipe;
			constructor(pipe: Dflow.Pipe) {
				super(DflowErrorBrokenPipe.message(pipe));
				this.pipe = pipe;
			}
			toJSON() {
				return this.toValue();
			}
			toValue() {
				return {
					errorName: "DflowErrorBrokenPipe",
					pipe: this.pipe,
				};
			}
			static message(pipe: Dflow.Pipe) {
				return `Broken DflowPipe from=${pipe.from} to=${pipe.to}`;
			}
		},

		NodeExecution: class DflowErrorNodeExecution extends Error {
			nodeErrorMessage: Error["message"];
			nodeId: Dflow.NodeId;
			nodeName: Dflow.Node["name"];
			constructor(
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			) {
				super(
					DflowErrorNodeExecution.message(
						nodeId,
						nodeName,
						nodeErrorMessage,
					),
				);
				this.nodeId = nodeId;
				this.nodeName = nodeName;
				this.nodeErrorMessage = nodeErrorMessage;
				this.name = Dflow.Error.NodeExecution.errorName;
			}
			toJSON() {
				return this.toValue();
			}
			toValue() {
				return {
					errorName: Dflow.Error.NodeExecution.errorName,
					nodeId: this.nodeId,
					nodeName: this.nodeName,
					nodeErrorMessage: this.nodeErrorMessage,
				};
			}
			static message(
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			) {
				return `Execution error on DflowNode name=${nodeName} id=${nodeId} error.message=${nodeErrorMessage}`;
			}
			static errorName = "DflowErrorNodeExecution";
		},

		NodeNotFound: class DflowErrorNodeNotFound extends Error {
			nodeId: Dflow.NodeId;
			constructor(nodeId: Dflow.NodeId) {
				super(DflowErrorNodeNotFound.message(nodeId));
				this.nodeId = nodeId;
				this.name = Dflow.Error.NodeNotFound.errorName;
			}
			toJSON() {
				return this.toValue();
			}
			toValue() {
				return {
					errorName: Dflow.Error.NodeNotFound.errorName,
					nodeId: this.nodeId,
				};
			}
			static message(nodeId: Dflow.NodeId) {
				return `Not found DflowNode nodeId=${nodeId}`;
			}
			static errorName = "DflowErrorNodeNotFound";
		},

		NodeOverride: class DflowErrorNodeOverride extends Error {
			nodeName: Dflow.Node["name"];
			constructor(name: Dflow.Node["name"]) {
				super(DflowErrorNodeOverride.message(name));
				this.nodeName = name;
				this.name = Dflow.Error.NodeOverride.errorName;
			}
			toJSON() {
				return this.toValue();
			}
			toValue() {
				return {
					errorName: Dflow.Error.NodeOverride.errorName,
					nodeName: this.nodeName,
				};
			}
			static message(name: Dflow.Node["name"]) {
				return `Cannot override existing DflowNode name=${name}`;
			}
			static errorName = "DflowErrorNodeOverride";
		},
	};
}
