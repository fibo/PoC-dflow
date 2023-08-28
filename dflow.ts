export type DflowId = string;
export type DflowName = string;

export type DflowPin = DflowId | [nodeId: DflowId, position: number];

export type DflowPinId = DflowId | `${DflowId},${number}`;

export type DflowPipe = {
  from: DflowPin;
  to: DflowPin;
};

export type DflowArgs = DflowName[];

export type DflowOuts = DflowName[];

export type DflowNode = {
  name: DflowName;
  args?: DflowArgs;
};

export type DflowCode = string | string[];

export type DflowNodeFunc = DflowNode & { code: DflowCode };

export type DflowGraph = {
  nodes: {
    id: DflowId;
    name: DflowName;
  }[];
  pipes: DflowPipe[];
};

export type DflowNodeGraph = DflowNode &
  DflowGraph & {
    outs?: DflowOuts;
  };

export class DflowErrorBrokenPipe extends Error {
  pipe: DflowPipe;
  static message(pipe: DflowPipe) {
    return `Broken DflowPipe from=${pipe.from} to=${pipe.to}`;
  }
  constructor(pipe: DflowPipe) {
    super(DflowErrorBrokenPipe.message(pipe));
    this.pipe = pipe;
  }
  toValue() {
    return {
      errorName: "DflowErrorBrokenPipe",
      pipe: this.pipe,
    };
  }
  toJSON() {
    return this.toValue();
  }
}

export class DflowErrorNodeExecution extends Error {
  nodeId: DflowId;
  nodeName: DflowName;
  nodeErrorMessage: Error["message"];
  static message(
    nodeId: DflowId,
    nodeName: DflowName,
    nodeErrorMessage: Error["message"]
  ) {
    return `Execution error on DflowNode name=${nodeName} id=${nodeId} error.message=${nodeErrorMessage}`;
  }
  constructor(
    nodeId: DflowId,
    nodeName: DflowName,
    nodeErrorMessage: Error["message"]
  ) {
    super(DflowErrorNodeExecution.message(nodeId, nodeName, nodeErrorMessage));
    this.nodeId = nodeId;
    this.nodeName = nodeName;
    this.nodeErrorMessage = nodeErrorMessage;
  }
  toValue() {
    return {
      errorName: "DflowErrorNodeExecution",
      nodeId: this.nodeId,
      nodeName: this.nodeName,
      nodeErrorMessage: this.nodeErrorMessage,
    };
  }
  toJSON() {
    return this.toValue();
  }
}

export class DflowErrorNodeOverride extends Error {
  nodeName: DflowName;
  static message(name: DflowName) {
    return `Cannot override existing DflowNode name=${name}`;
  }
  constructor(name: DflowName) {
    super(DflowErrorNodeOverride.message(name));
    this.nodeName = name;
  }
  toValue() {
    return {
      errorName: "DflowErrorNodeOverride",
      nodeName: this.nodeName,
    };
  }
  toJSON() {
    return this.toValue();
  }
}

export type DflowFunc =
  | typeof Dflow.Func
  | typeof Dflow.AsyncFunc
  | typeof Dflow.GeneratorFunc;

export class Dflow implements DflowNodeGraph {
  name: DflowName;
  args?: DflowArgs;
  outs?: DflowOuts;

  hasAsyncNodes: boolean;

  nodeNameById = new Map<DflowId, DflowName>();
  funcByName = new Map<DflowName, DflowFunc>();

  /** Map of pipes, key=to value=from */
  pipesMap = new Map<DflowPinId, DflowPinId>();

  outsData: Map<DflowPinId, unknown>;

  argNodeNames = new Set<DflowName>();
  outNodeNames = new Set<DflowName>();
  nodeArgsByName = new Map<DflowName, DflowArgs>();
  nodeOutsByName = new Map<DflowName, DflowOuts>();
  graphByName = new Map<DflowName, DflowGraph>();

  constructor(
    { name, args, outs, nodes, pipes }: DflowNodeGraph = {
      name: Dflow.rootName,
      nodes: [],
      pipes: [],
    }
  ) {
    this.name = name;

    if (args) {
      for (const arg of args) this.setNodeArg(arg);
    }
    this.args = args;

    if (outs) {
      for (const out of outs) this.setNodeOut(out);
    }
    this.outs = outs;

    this.outsData = new Map();

    this.insert({ nodes, pipes });
    this.hasAsyncNodes = false;
  }

  toValue(): DflowNodeGraph {
    return {
      name: this.name,
      args: this.args,
      outs: this.outs,
      ...this.graph,
    };
  }

  toJSON() {
    return this.toValue();
  }

  get data() {
    return Object.fromEntries(this.outsData.entries());
  }

  get nodeIds(): DflowId[] {
    return Array.from(this.nodeNameById.keys());
  }

  get nodes(): DflowGraph["nodes"] {
    return Array.from(this.nodeNameById.entries(), ([id, name]) => ({
      id,
      name,
    }));
  }

  get pipes(): DflowGraph["pipes"] {
    return Array.from(this.pipesMap.entries(), ([toId, fromId]) => ({
      from: Dflow.idToPin(fromId),
      to: Dflow.idToPin(toId),
    }));
  }

  get graph(): DflowGraph {
    return {
      nodes: this.nodes,
      pipes: this.pipes,
    };
  }

  addNode(name: DflowNode["name"], id = Dflow.generateId()): DflowId {
    this.nodeNameById.set(id, name);
    return id;
  }

  addPipe(pipe: DflowPipe) {
    if (this.isBrokenPipe(pipe)) {
      throw new DflowErrorBrokenPipe(pipe);
    } else {
      this.pipesMap.set(Dflow.pinToId(pipe.to), Dflow.pinToId(pipe.from));
    }
  }

  pipesOfSourceId(sourceId: DflowPinId): DflowPipe[] {
    const pipes: DflowPipe[] = [];
    for (const [toId, fromId] of this.pipesMap.entries()) {
      if (fromId === sourceId) {
        pipes.push({
          from: Dflow.idToPin(fromId),
          to: Dflow.idToPin(toId),
        });
      }
    }
    return pipes;
  }

  pipeOfTargetId(targetId: DflowPinId): DflowPipe | undefined {
    for (const [toId, fromId] of this.pipesMap.entries()) {
      if (toId === targetId) {
        return {
          from: Dflow.idToPin(fromId),
          to: Dflow.idToPin(toId),
        };
      }
    }
  }

  insert({ nodes, pipes }: DflowGraph) {
    for (const node of nodes) {
      this.addNode(node.name, node.id);
    }
    for (const pipe of pipes) {
      this.addPipe(pipe);
    }
  }

  isBrokenPipe(pipe: DflowPipe) {
    const [sourceId, targetId] = Dflow.nodeIdsOfPipe(pipe);
    return !this.nodeNameById.has(sourceId) || !this.nodeNameById.has(targetId);
  }

  hasNode(name: DflowName) {
    return (
      this.argNodeNames.has(name) ||
      this.outNodeNames.has(name) ||
      this.funcByName.has(name) ||
      this.graphByName.has(name)
    );
  }

  setFunc(name: DflowName, func: DflowFunc, args?: DflowArgs) {
    this.setNode({ name, args });
    if (this.hasNode(name)) {
      throw new DflowErrorNodeOverride(name);
    }
    if (args) this.nodeArgsByName.set(name, args);
    if (Dflow.isAsyncFunc(func) || Dflow.isAsyncGeneratorFunc(func)) {
      this.hasAsyncNodes = true;
    }
    this.funcByName.set(name, func);
  }

  setNode({ name, args }: DflowNode) {
    if (this.hasNode(name)) {
      throw new DflowErrorNodeOverride(name);
    }
    if (args) this.nodeArgsByName.set(name, args);
  }

  setNodeArg(name: DflowName) {
    this.setNode({ name });
  }

  setNodeOut(name: DflowName) {
    this.setNode({ name, args: ["out"] });
  }

  setNodeFunc({ name, args, code }: DflowNodeFunc) {
    this.setNode({ name, args });
    if (Dflow.looksLikeAsyncCode(code)) {
      if (args) {
        this.setFunc(
          name,
          Dflow.AsyncFunc(...args, Dflow.funcBody(code)),
          args
        );
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

  setNodeGraph({ name, args, outs, nodes, pipes }: DflowNodeGraph) {
    this.setNode({ name, args });
    if (outs) this.nodeOutsByName.set(name, outs);
    this.graphByName.set(name, { nodes, pipes });
  }

  static rootName = "root";

  static Func = function () {}.constructor;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
  static AsyncFunc = async function () {}.constructor;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/GeneratorFunction/GeneratorFunction
  static GeneratorFunc = function* () {}.constructor;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGeneratorFunction
  static AsyncGeneratorFunc = async function* () {}.constructor;

  static isFunc(func: unknown) {
    return func?.constructor === Dflow.Func;
  }

  static isAsyncFunc(func: unknown) {
    return func?.constructor === Dflow.AsyncFunc;
  }

  static isAsyncGeneratorFunc(func: unknown) {
    return func?.constructor === Dflow.AsyncGeneratorFunc;
  }

  static isGeneratorFunc(func: unknown) {
    return func?.constructor === Dflow.GeneratorFunc;
  }

  static looksLikeAsyncGeneratorCode(arg: DflowCode) {
    return arg.includes("await") && arg.includes("yield");
  }

  static looksLikeAsyncCode(arg: DflowCode) {
    return arg.includes("await") && !arg.includes("yield");
  }

  static looksLikeGeneratorCode(arg: DflowCode) {
    return !arg.includes("await") && arg.includes("yield");
  }

  static pinToId(pin: DflowPin): DflowPinId {
    return typeof pin === "string" ? pin : pin[1] === 0 ? pin[0] : pin.join();
  }

  static idToPin(id: DflowPinId): DflowPin {
    const [nodeId, positionStr] = id.split(",");
    const position = Number(positionStr);
    return position ? [nodeId, position] : nodeId;
  }

  static funcBody(arg: DflowCode) {
    return typeof arg === "string" ? arg : arg.join(";");
  }

  static nodeIdOfPin(pin: DflowPin): DflowId {
    return typeof pin === "string" ? pin : pin[0];
  }

  static positionOfPin(pin: DflowPin): number | undefined {
    return typeof pin === "string" ? undefined : pin[1];
  }

  static nodeIdsOfPipe({
    from: source,
    to: target,
  }: DflowPipe): [sourceId: DflowId, targetId: DflowId] {
    return [Dflow.nodeIdOfPin(source), Dflow.nodeIdOfPin(target)];
  }

  static parentNodeIds(nodeId: DflowId, pipes: DflowPipe[]): DflowId[] {
    return pipes
      .filter(({ to }) =>
        typeof to === "string" ? to === nodeId : to[0] === nodeId
      )
      .map(({ from }) => (typeof from === "string" ? from : from[0]));
  }

  static generateId(): DflowId {
    return crypto.randomUUID().substring(0, 8);
  }

  /**
   * The level of a node is a number that indicates its position in the graph.
   *
   * @example
   *
   * ```ts
   * const nodeIdsSortedByLevel = (
   *   nodeIds: DflowId[],
   *   pipes: DflowPipe[],
   * ): DflowId[] => {
   *   const levelOfNode: Record<DflowId, number> = {}
   *   for (const nodeId of nodeIds) {
   *     levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes)
   *   }
   *   return nodeIds.slice().sort((nodeIdA, nodeIdB) =>
   *     (levelOfNode[nodeIdA]) <= levelOfNode[nodeIdB] ? -1 : 1
   *   )
   * }
   * ```
   */
  static levelOfNode(nodeId: DflowId, pipes: DflowPipe[]): number {
    const parentsNodeIds = Dflow.parentNodeIds(nodeId, pipes);
    // 1. A node with no parent as level zero.
    if (parentsNodeIds.length === 0) return 0;
    // 2. Otherwise its level is the max level of its parents plus one.
    let maxLevel = 0;
    for (const parentNodeId of parentsNodeIds) {
      maxLevel = Math.max(Dflow.levelOfNode(parentNodeId, pipes), maxLevel);
    }
    // TODO in un Directed Cyclic Graph il level è finito
    // devo controllare se i nodeId si vedono più di una volta, allora è un ciclo
    // in quel caso ritorno level Infinity
    return maxLevel + 1;
  }
}
