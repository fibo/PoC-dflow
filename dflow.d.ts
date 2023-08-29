/** https://github.com/fibo/dflow @license MIT */
export declare namespace Dflow {
	/** A Dflow.Func is a function, an async function, a generator or an async generator */
	type Func = DflowFunc;
	type Name = string;
	/** Dflow.Args is a list of argument names */
	type Args = Dflow.Name[];
	/** A Dflow.Node is a base type for an executable unit: for example a function */
	type Node = {
		name: Dflow.Name;
		args?: Dflow.Args;
	};
	/** A Dflow.Code can hold one or more lines of JavaScript code */
	type Code = string | string[];
	/** A Dflow.NodeFunc is a node with some code. */
	type NodeFunc = Dflow.Node & {
		code: Dflow.Code;
	};
	/** A Dflow.NodeId is a node identifier */
	type NodeId = string;
	/** A Dflow.Pin can be an input or an output of a node */
	type Pin = Dflow.NodeId | [nodeId: Dflow.NodeId, position: number];
	/** Stringified Dflow.Pin */
	type PinId = Dflow.NodeId | `${Dflow.NodeId},${number}`;
	/** A Dflow.Pipe connects from a source Dflow.Pin to a target Dflow.Pin */
	type Pipe = {
		from: Dflow.Pin;
		to: Dflow.Pin;
	};
	/** A Dflow.Graph is a collection of nodes and pipes */
	type Graph = {
		nodes: {
			id: Dflow.NodeId;
			name: Dflow.Name;
		}[];
		pipes: Dflow.Pipe[];
	};
	/** A Dflow.Outs is a list of one or more declared outputs for a node */
	type Outs = Dflow.Name[];
	type NodeGraph = Dflow.Node & Dflow.Graph & {
		outs?: Dflow.Outs;
	};
	/** Dflow.GraphInstances is a generic to define a Map of graph instances */
	type GraphInstances<T extends Dflow> = Map<Dflow.NodeId, T>;
}
type DflowFunc =
	| typeof Dflow.AsyncFunc
	| typeof Dflow.AsyncGeneratorFunc
	| typeof Dflow.Func
	| typeof Dflow.GeneratorFunc;
export declare class Dflow {
	name: Dflow.Name;
	args?: Dflow.Args;
	outs?: Dflow.Outs;
	argNodeNames: Set<string>;
	funcByName: Map<string, Function>;
	/**
	 * A context to bound the Dflow.Func execution.
	 *   - key: func name
	 *   - value: context, if any
	 */
	funcContext: Map<string, unknown>;
	graphByName: Map<string, Dflow.Graph>;
	/**
	 * Graph instances.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   // Override graphInstances to get the proper instance type.
	 *   graphInstances: Dflow.GraphInstances<MyDflow> = new Map();
	 *
	 *   // Add a sub-graph instance of MyDflow.
	 *   addSubGraph(graph: Dflow.NodeGraph, id = Dflow.ID()) {
	 *     const subGraph = new MyDflow(graph);
	 *     subGraph.inheritFuncs({
	 *       funcByName: new Map(this.funcByName),
	 *       funcContext: new Map(this.funcContext),
	 *       nodeArgsByName: new Map(this.nodeArgsByName),
	 *     });
	 *     this.graphInstances.set(id, subGraph);
	 *   }
	 * }
	 * ```
	 */
	graphInstances: Dflow.GraphInstances<Dflow>;
	nodeArgsByName: Map<string, Dflow.Args>;
	/**
	 * Node instances.
	 *   - key node id
	 *   - value node name
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
	/**
	 * Node output names.
	 */
	nodeOutsByName: Map<string, Dflow.Outs>;
	outNodeNames: Set<string>;
	/**
	 * Every output data.
	 * - key
	 *   - key=pinId, of the related output
	 *   - value=data
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
	 *  - key=targetId, pipe.to
	 *  - value=sourceId, pipe.from
	 *
	 * @example
	 * ```ts
	 * const pipes: Dflow.Graph["pipes"] = Array.from(
	 *   this.pipe.entries(), ([toId, fromId]) => ({
	 *     from: Dflow.idToPin(fromId),
	 *     to: Dflow.idToPin(toId),
	 *   })
	 * )
	 * ```
	 */
	pipe: Map<string, string>;
	constructor({ name, args, outs, nodes, pipes }?: Dflow.NodeGraph);
	/**
	 * A Dflow has async nodes if some of its DflowFunc is async or if some of its sub-graphs is async.
	 *
	 * @example
	 * ```ts
	 * class MyDflow extends Dflow {
	 *   async run () {
	 *    // execution code
	 *   }
	 * }
	 *
	 * const graph = new MyDflow()
	 *
	 * if (graph.hasAsyncNodes()) {
	 *   await graph.run()
	 * } else {
	 *   graph.run()
	 * }
	 * ```
	 */
	get hasAsyncNodes(): boolean;
	addNode(name: Dflow.Node["name"], id?: string): Dflow.NodeId;
	addPipe(pipe: Dflow.Pipe): void;
	insert({ nodes, pipes }: Dflow.Graph): void;
	hasNode(name: Dflow.Name): boolean;
	/**
	 * Inherits funcs; do not override this args and outs.
	 */
	inheritFuncs(
		{ funcByName, funcContext, nodeArgsByName }: Pick<
			Dflow,
			"funcByName" | "funcContext" | "nodeArgsByName"
		>,
	): void;
	isBrokenPipe(pipe: Dflow.Pipe): boolean;
	pipesOfSourceId(sourceId: Dflow.PinId): Dflow.Pipe[];
	pipeOfTargetId(targetId: Dflow.PinId): Dflow.Pipe | undefined;
	setFunc(name: Dflow.Name, func: Dflow.Func, args?: Dflow.Args): void;
	setNode({ name, args }: Dflow.Node): void;
	setNodeFunc({ name, args, code }: Dflow.NodeFunc): void;
	setNodeGraph({ name, args, outs, nodes, pipes }: Dflow.NodeGraph): void;
	toJSON(): Dflow.NodeGraph;
	toValue(): Dflow.NodeGraph;
	static AsyncFunc: Function;
	static Func: Function;
	static GeneratorFunc: Function;
	static AsyncGeneratorFunc: Function;
	static funcBody(arg: Dflow.Code): string;
	/** Generate a node id */
	static ID(): Dflow.NodeId;
	static idToPin(id: Dflow.PinId): Dflow.Pin;
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
	static isFunc(func: unknown): boolean;
	static isGeneratorFunc(func: unknown): boolean;
	static looksLikeAsyncGeneratorCode(arg: Dflow.Code): boolean;
	static looksLikeAsyncCode(arg: Dflow.Code): boolean;
	static looksLikeGeneratorCode(arg: Dflow.Code): boolean;
	static nodeIdOfPin(pin: Dflow.Pin): Dflow.NodeId;
	static nodeIdsOfPipe(
		{ from, to }: Dflow.Pipe,
	): [sourceNodeId: Dflow.NodeId, targetNodeId: Dflow.NodeId];
	static parentNodeIds(
		nodeId: Dflow.NodeId,
		pipes: Dflow.Pipe[],
	): Dflow.NodeId[];
	static pinToPinId(pin: Dflow.Pin): Dflow.PinId;
	static positionOfPin(pin: Dflow.Pin): number | undefined;
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
			};
			message(pipe: Dflow.Pipe): string;
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
			};
			message(
				nodeId: Dflow.NodeId,
				nodeName: Dflow.Node["name"],
				nodeErrorMessage: Error["message"],
			): string;
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
			};
			message(name: Dflow.Node["name"]): string;
		};
	};
}
export {};
