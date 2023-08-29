import { Dflow } from "./dflow.ts";

export class DflowStepExecutor extends Dflow {
	graphInstanceById: Dflow.GraphInstanceMap<DflowStepExecutor> = new Map();

	async run() {
		// Sort nodes by level

		const pipes = this.pipes;
		const levelOfNode: Record<Dflow.NodeId, number> = {};
		const nodes = Array.from(this.nodeNameById.entries());
		for (const [nodeId] of nodes) {
			levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes);
		}
		nodes.sort(([nodeIdA], [nodeIdB]) =>
			levelOfNode[nodeIdA] <= levelOfNode[nodeIdB] ? -1 : 1
		);

		for (const [nodeId, nodeName] of nodes) {
			// Collect arg values.

			const argValues: unknown[] = [];

			const nodeArgNames = this.nodeArgsByName.get(nodeName);

			if (nodeArgNames) {
				for (let position = 0; position < nodeArgNames.length; position++) {
					const pipe = this.pipeOfTargetId(
						Dflow.pinToPinId([nodeId, position]),
					);
					if (pipe) {
						argValues.push(this.outsData.get(Dflow.pinToPinId(pipe.from)));
					} else {
						argValues.push(undefined);
					}
				}
			}

			// Execute node func, if any.

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
							error.message,
						);
					} else {
						throw error;
					}
				}
			}

			// If node is a graph, create sub-graph instance.

			const graph = this.graphByName.get(nodeName);

			if (graph) {
				const subGraph = new DflowStepExecutor({
					name: nodeName,
					args: this.nodeArgsByName.get(nodeName),
					outs: this.nodeOutsByName.get(nodeName),
					...graph,
				});
				subGraph.inheritFuncs({
					funcByName: new Map(this.funcByName),
					funcContext: new Map(this.funcContext),
					nodeArgsByName: new Map(this.nodeArgsByName),
				});
				this.graphInstanceById.set(nodeId, subGraph);
			}

			// Run grapn instance, if any.

			const subGraph = this.graphInstanceById.get(nodeId);

			if (subGraph) {
				// 1. Set graph input values.
				if (nodeArgNames) {
					for (
						const [subGraphNodeId, nodeName] of subGraph.nodeNameById.entries()
					) {
						for (
							let position = 0;
							position < nodeArgNames.length;
							position++
						) {
							if (nodeName === nodeArgNames[position]) {
								subGraph.outsData.set(
									Dflow.pinToPinId([subGraphNodeId, position]),
									argValues[position],
								);
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
					for (
						const [subGraphNodeId, nodeName] of subGraph.nodeNameById.entries()
					) {
						for (
							let position = 0;
							position < nodeOutNames.length;
							position++
						) {
							if (nodeName === nodeOutNames[position]) {
								const pipe = subGraph.pipeOfTargetId(subGraphNodeId);
								if (pipe) {
									this.outsData.set(
										Dflow.pinToPinId([nodeId, position]),
										subGraph.outsData.get(Dflow.pinToPinId(pipe.from)),
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
