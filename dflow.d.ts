/// <reference types="node" />
/** https://github.com/fibo/dflow @license MIT */
export declare namespace Dflow {
	/** A Dflow.Func is a function, an async function, a generator or an async generator */
	type Func = DflowFunc;
	type ArgName = string;
	type NodeName = string;
	type OutName = string;
	/** Dflow.Args is a list of argument names */
	type Args = Dflow.ArgName[];
	/**
	 * A Dflow.NodeId is a node identifier.
	 *
	 * The id generation is not provided by Dflow,
	 * but is supposed that ids does not contain commas.
	 */
	type NodeId = string;
	/** A Dflow.Node is an executable unit: can be a Dflow.NodeFunc or a Dflow.NodeGraph */
	type Node = {
		id: Dflow.NodeId;
		name: Dflow.NodeName;
	};
	/** A Dflow.Pin can be an input or an output of a node */
	type Pin = Dflow.NodeId | [nodeId: Dflow.NodeId, position: number];
	/**
	 * A Dflow.PinId is composed by a Dflow.NodeId and pin position;
	 * if position is zero, it is omitted.
	 */
	type PinId = Dflow.NodeId | `${Dflow.NodeId},${number}`;
	/** A Dflow.Pipe connects from a Dflow.Pin to a Dflow.Pin */
	type Pipe = {
		from: Dflow.Pin;
		to: Dflow.Pin;
	};
	type PipeId = [to: Dflow.PinId, from: Dflow.PinId];
	/** A Dflow.Graph is a collection of nodes and pipes */
	type Graph = {
		nodes: Dflow.Node[];
		pipes: Dflow.Pipe[];
	};
	/** A Dflow.Code can hold one or more lines of JavaScript code */
	type Code = string | string[];
	/** A Dflow.NodeFunc is a node with some code. */
	type NodeFunc = {
		name: Dflow.NodeName;
		args?: Dflow.Args;
		code: Dflow.Code;
	};
	/** A Dflow.Outs is a list of one or more declared outputs for a node */
	type Outs = Dflow.OutName[];
	type NodeGraph = {
		name: Dflow.NodeName;
		args?: Dflow.Args;
		outs?: Dflow.Outs;
	} & Dflow.Graph;
}
type DflowFunc =
	| typeof Dflow.AsyncFunc
	| typeof Dflow.AsyncGeneratorFunc
	| typeof Dflow.Func
	| typeof Dflow.GeneratorFunc;
export declare class Dflow {
	name: Dflow.NodeName;
	args?: Dflow.Args;
	outs?: Dflow.Outs;
	/**
	 * A context to bound the Dflow.Func execution.
	 *   - key: node id or name
	 *   - value: context, if any
	 *
	 * Notice that the key can be a node id or a node name.
	 * If a context with a node id is found it takes precedence over a context associated to the node name.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   log(id: Dflow.NodeId, ...args: any[]) {
	 *     console.log(id, ...args)
	 *   }
	 *
	 *   addNode(name: Dflow.NodeName, id = crypto.randomUUID()): Dflow.NodeId {
	 *     this.context.set(id, { log: this.log.bind(null, id) });
	 *     return super.addNode(name, id)
	 *   }
	 * }
	 *
	 * const dflow = new MyDflow()
	 *
	 * dflow.setNodeFunc({
	 *   name: "hello",
	 *   code: "this.log('hello world')"
	 * })
	 * dflow.addNode("hello")
	 *
	 * await dflow.run()
	 * ```
	 */
	context: Map<string, unknown>;
	func: Map<string, Function>;
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
	 *
	 *   createGraph(
	 *     nodeId: Dflow.NodeId,
	 *     nodeGraph: Dflow.NodeGraph | undefined = undefined,
	 *   ) {
	 *     if (!nodeGraph) return;
	 *     if (this.graph.has(nodeId)) return;
	 *     const graph = new MyDflow(nodeGraph);
	 *     graph.inherit(this);
	 *     this.graph.set(nodeId, graph);
	 *   }
	 * }
	 * ```
	 */
	graph: Map<string, Dflow>;
	/** Names of nodes that correspond to args and outs of a graph. */
	ioNodes: Set<string>;
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
	node: Map<string, string>;
	/** Argument names of a node */
	nodeArgs: Map<string, Dflow.Args>;
	nodeGraph: Map<string, Dflow.NodeGraph>;
	/**
	 * Node output names.
	 */
	nodeOuts: Map<string, Dflow.Outs>;
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
	out: Map<string, unknown>;
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
	pipe: Map<string, string>;
	constructor({ name, args, outs, nodes, pipes }?: Dflow.NodeGraph);
	/**
	 * Nodes sorted by level.
	 */
	get nodes(): [id: Dflow.NodeId, name: Dflow.NodeName][];
	/**
	 * Add a node to a graph.
	 *
	 * You may want to override this method to provide an id by default.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   addNode(name: Dflow.Node["name"], id = crypto.randomUUID()): Dflow.NodeId {
	 *     return super.addNode(name, id);
	 *   }
	 * }
	 * ```
	 */
	addNode(name: Dflow.NodeName, id: Dflow.NodeId): Dflow.NodeId;
	/**
	 * Create a pipe from a node output to a node input arg.
	 */
	addPipe(pipe: Dflow.Pipe): void;
	/**
	 * Create a graph instance.
	 */
	createGraph(
		nodeId: Dflow.NodeId,
		nodeGraph?: Dflow.NodeGraph | undefined,
	): void;
	/**
	 * Delete a node from graph.
	 */
	delNode(nodeId: Dflow.NodeId): void;
	/**
	 * Delete a pipe from graph.
	 */
	delPipe(to: Dflow.Pipe["to"]): void;
	/**
	 * Collect argument values for node instance.
	 */
	argValues(nodeId: Dflow.NodeId): unknown[];
	/**
	 * Delete nodes and pipes from graph.
	 *
	 * When a node is deleted, also the pipes that are connected are deleted.
	 * Return deleted items graph.
	 */
	delete({
		nodes,
		pipes,
	}: Partial<{
		nodes: {
			id: Dflow.NodeId;
		}[];
		pipes: {
			to: Dflow.Pin;
		}[];
	}>): Dflow.Graph;
	/**
	 * Inherit funcs, args and contexts.
	 *
	 * Does not override ioNodes.
	 */
	inherit(dflow: Pick<Dflow, "func" | "context" | "nodeArgs">): void;
	insert({ nodes, pipes }: Partial<Dflow.Graph>): void;
	/**
	 * Check that node name is available or throw Dflow.Error.NodeOverride
	 * @internal
	 */
	private isAvailableNode;
	run(): Promise<void>;
	runFunc(
		nodeId: Dflow.NodeId,
		func?: Dflow.Func | undefined,
		context?: unknown,
	): Promise<void>;
	runGraph(graphId: Dflow.NodeId, graph?: Dflow | undefined): Promise<void>;
	runNode(
		nodeId: Dflow.NodeId,
		nodeName?: Dflow.NodeName | undefined,
	): Promise<void>;
	setFunc(name: Dflow.NodeName, func: Dflow.Func, args?: Dflow.Args): void;
	setNodeArg(name: Dflow.NodeName): void;
	setNodeFunc({ name, args, code }: Dflow.NodeFunc): void;
	setNodeGraph({ name, args, outs, nodes, pipes }: Dflow.NodeGraph): void;
	setNodeOut(name: Dflow.NodeName): void;
	toJSON(): Dflow.NodeGraph;
	toString(): string;
	toValue(): Dflow.NodeGraph;
	static AsyncFunc: Function;
	static Func: Function;
	static GeneratorFunc: Function;
	static AsyncGeneratorFunc: Function;
	/**
	 * Convert a Dflow.Code to a string of code.
	 *
	 * @example
	 * ```ts
	 * const func = Dflow.Func(Dflow.funcBody(code));
	 * ```
	 */
	static funcBody(code: Dflow.Code): string;
	static pinIdToPin(id: Dflow.PinId): Dflow.Pin;
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
	static levelOfNode(nodeId: Dflow.NodeId, pipes: Dflow.Pipe[]): number;
	static isAsyncFunc(func: unknown): boolean;
	static isAsyncGeneratorFunc(func: unknown): boolean;
	static isBrokenPipe(pipe: Dflow.Pipe, node: Dflow["node"]): boolean;
	static isFunc(func: unknown): boolean;
	static isGeneratorFunc(func: unknown): boolean;
	static looksLikeAsyncGeneratorCode(arg: Dflow.Code): boolean;
	static looksLikeAsyncCode(arg: Dflow.Code): boolean;
	static looksLikeGeneratorCode(arg: Dflow.Code): boolean;
	static nodeIdOfPin(pin: Dflow.Pin): Dflow.NodeId;
	static nodeIdsOfPipe({
		from,
		to,
	}: Dflow.Pipe): [source: Dflow.NodeId, target: Dflow.NodeId];
	static parentNodeIds(
		nodeId: Dflow.NodeId,
		pipes: Dflow.Pipe[],
	): Dflow.NodeId[];
	static pinToPinId(pin: Dflow.Pin): Dflow.PinId;
	static pipeIdToPipe([to, from]: Dflow.PipeId): Dflow.Pipe;
	static Error: {
		BrokenPipe: {
			new (pipe: Dflow.Pipe): {
				pipe: Dflow.Pipe;
				toJSON(): {
					errorName: string;
					pipe: Dflow.Pipe;
				};
				toValue(): {
					errorName: string;
					pipe: Dflow.Pipe;
				};
				name: string;
				message: string;
				stack?: string | undefined;
				cause?: unknown;
			};
			message(pipe: Dflow.Pipe): string;
			captureStackTrace(
				targetObject: object,
				constructorOpt?: Function | undefined,
			): void;
			prepareStackTrace?:
				| ((err: Error, stackTraces: NodeJS.CallSite[]) => any)
				| undefined;
			stackTraceLimit: number;
		};
		NodeExecution: {
			new (
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			): {
				nodeErrorMessage: Error["message"];
				nodeId: Dflow.NodeId;
				nodeName: Dflow.Node["name"];
				toJSON(): {
					errorName: string;
					nodeId: string;
					nodeName: string;
					nodeErrorMessage: string;
				};
				toValue(): {
					errorName: string;
					nodeId: string;
					nodeName: string;
					nodeErrorMessage: string;
				};
				name: string;
				message: string;
				stack?: string | undefined;
				cause?: unknown;
			};
			message(
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			): string;
			errorName: string;
			captureStackTrace(
				targetObject: object,
				constructorOpt?: Function | undefined,
			): void;
			prepareStackTrace?:
				| ((err: Error, stackTraces: NodeJS.CallSite[]) => any)
				| undefined;
			stackTraceLimit: number;
		};
		NodeNotFound: {
			new (nodeId: Dflow.NodeId): {
				nodeId: Dflow.NodeId;
				toJSON(): {
					errorName: string;
					nodeId: string;
				};
				toValue(): {
					errorName: string;
					nodeId: string;
				};
				name: string;
				message: string;
				stack?: string | undefined;
				cause?: unknown;
			};
			message(nodeId: Dflow.NodeId): string;
			errorName: string;
			captureStackTrace(
				targetObject: object,
				constructorOpt?: Function | undefined,
			): void;
			prepareStackTrace?:
				| ((err: Error, stackTraces: NodeJS.CallSite[]) => any)
				| undefined;
			stackTraceLimit: number;
		};
		NodeOverride: {
			new (name: Dflow.Node["name"]): {
				nodeName: Dflow.Node["name"];
				toJSON(): {
					errorName: string;
					nodeName: string;
				};
				toValue(): {
					errorName: string;
					nodeName: string;
				};
				name: string;
				message: string;
				stack?: string | undefined;
				cause?: unknown;
			};
			message(name: Dflow.NodeName): string;
			errorName: string;
			captureStackTrace(
				targetObject: object,
				constructorOpt?: Function | undefined,
			): void;
			prepareStackTrace?:
				| ((err: Error, stackTraces: NodeJS.CallSite[]) => any)
				| undefined;
			stackTraceLimit: number;
		};
	};
}
export {};
