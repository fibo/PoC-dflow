import { Dflow } from "./dflow.ts";

export class DflowStepExecutor extends Dflow {
  graphInstanceById: Dflow.GraphInstanceMap<DflowStepExecutor> = new Map();

  addNodeGraph(nodeGraph: Dflow.NodeGraph, id = Dflow.generateId()) {
    const subGraph = new DflowStepExecutor(nodeGraph);
    subGraph.inheritFuncs({
      funcByName: new Map(this.funcByName),
      funcContext: new Map(this.funcContext),
      nodeArgsByName: new Map(this.nodeArgsByName),
    });
    this.graphInstanceById.set(id, subGraph);
  }

  async run() {
    const nodeIds = this.nodeIds;
    const pipes = this.pipes;

    const levelOfNode: Record<Dflow.Id, number> = {};
    for (const nodeId of nodeIds) {
      levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes);
    }
    nodeIds.sort((nodeIdA, nodeIdB) =>
      levelOfNode[nodeIdA] <= levelOfNode[nodeIdB] ? -1 : 1
    );

    for (const nodeId of nodeIds) {
      const nodeName = this.nodeNameById.get(nodeId);
      if (nodeName) {
        const graph = this.graphByName.get(nodeName);
        if (graph) {
          this.addNodeGraph(
            {
              name: nodeName,
              args: this.nodeArgsByName.get(nodeName),
              outs: this.nodeOutsByName.get(nodeName),
              ...graph,
            },
            nodeId
          );
        }
      }
    }

    NODES: for (const nodeId of nodeIds) {
      const nodeName = this.nodeNameById.get(nodeId);
      if (!nodeName) {
        continue NODES;
      }
      const argValues: unknown[] = [];

      const nodeArgNames = this.nodeArgsByName.get(nodeName);

      if (nodeArgNames) {
        for (let position = 0; position < nodeArgNames.length; position++) {
          const pipe = this.pipeOfTargetId(Dflow.pinToId([nodeId, position]));
          if (pipe) {
            argValues.push(this.outsData.get(Dflow.pinToId(pipe.from)));
          } else {
            argValues.push(undefined);
          }
        }
      }

      const func = this.funcByName.get(nodeName);

      if (func) {
        try {
          const context = this.funcContext.get(nodeName) ?? null;
          if (Dflow.isAsyncFunc(func)) {
            const data = await func.apply(context, argValues);
            this.outsData.set(nodeId, data);
          } else if (Dflow.isFunc(func)) {
            const data = func.apply(context, argValues);
            this.outsData.set(nodeId, data);
          }
        } catch (error) {
          if (error instanceof Error) {
            throw new Dflow.Error.NodeExecution(
              nodeId,
              nodeName,
              error.message
            );
          } else {
            throw error;
          }
        }
      }

      const subGraph = this.graphInstanceById.get(nodeId);

      if (subGraph) {
        // 1. Set graph input values.
        if (nodeArgNames) {
          for (const subGraphNodeId of subGraph.nodeIds) {
            const nodeName = subGraph.nodeNameById.get(subGraphNodeId);
            if (nodeName) {
              for (
                let position = 0;
                position < nodeArgNames.length;
                position++
              ) {
                if (nodeName === nodeArgNames[position]) {
                  subGraph.outsData.set(
                    Dflow.pinToId([subGraphNodeId, position]),
                    argValues[position]
                  );
                }
              }
            }
          }
        }
        // 2. Execute graph.
        if (subGraph.hasAsyncNodes) {
          await subGraph.run();
        } else {
          subGraph.run();
        }
        // 3. Get graph output values.
        const nodeOutNames = this.nodeOutsByName.get(nodeName);
        if (nodeOutNames) {
          for (const subGraphNodeId of subGraph.nodeIds) {
            const nodeName = subGraph.nodeNameById.get(subGraphNodeId);
            if (nodeName) {
              for (
                let position = 0;
                position < nodeOutNames.length;
                position++
              ) {
                if (nodeName === nodeOutNames[position]) {
                  const pipe = subGraph.pipeOfTargetId(subGraphNodeId);
                  if (pipe) {
                    this.outsData.set(
                      Dflow.pinToId([nodeId, position]),
                      subGraph.outsData.get(Dflow.pinToId(pipe.from))
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
