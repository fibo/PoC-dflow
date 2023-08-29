import { Dflow } from "./dflow.js";

export class DflowStepExecutor extends Dflow {
	graphInstances: Dflow.GraphInstances<DflowStepExecutor> = new Map();

	get data() {
		return Object.fromEntries(this.out.entries());
	}

	async run() {
		// Sort nodes by level

		const pipes = Array.from(this.pipe.entries(), ([toId, fromId]) => ({
			from: Dflow.idToPin(fromId),
			to: Dflow.idToPin(toId),
		}));
		const levelOfNode: Record<Dflow.NodeId, number> = {};
		const nodes = Array.from(this.node.entries());
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
				for (
					let position = 0;
					position < nodeArgNames.length;
					position++
				) {
					const pipe = this.pipeOfTargetId(
						Dflow.pinToPinId([nodeId, position])
					);
					if (pipe) {
						argValues.push(
							this.out.get(Dflow.pinToPinId(pipe.from))
						);
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
						this.out.set(nodeId, data);
					} else if (Dflow.isFunc(func)) {
						const data = func.apply(context, argValues);
						this.out.set(nodeId, data);
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
				this.graphInstances.set(nodeId, subGraph);
			}

			// Run graph instance, if any.

			const subGraph = this.graphInstances.get(nodeId);

			if (subGraph) {
				// 1. Set graph input values.
				if (nodeArgNames) {
					for (const [
						subGraphNodeId,
						nodeName,
					] of subGraph.node.entries()) {
						for (
							let position = 0;
							position < nodeArgNames.length;
							position++
						) {
							if (nodeName === nodeArgNames[position]) {
								subGraph.out.set(
									Dflow.pinToPinId([
										subGraphNodeId,
										position,
									]),
									argValues[position]
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
					for (const [
						subGraphNodeId,
						nodeName,
					] of subGraph.node.entries()) {
						for (
							let position = 0;
							position < nodeOutNames.length;
							position++
						) {
							if (nodeName === nodeOutNames[position]) {
								const pipe =
									subGraph.pipeOfTargetId(subGraphNodeId);
								if (pipe) {
									this.out.set(
										Dflow.pinToPinId([nodeId, position]),
										subGraph.out.get(
											Dflow.pinToPinId(pipe.from)
										)
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
