import { Dflow, DflowId, DflowNodeGraph, DflowPinId } from "./dflow.ts"

export class DflowStepExecutor extends Dflow {
	dataMap: Map<DflowPinId, unknown>
	subGraphInstanceById: Map<DflowId, DflowStepExecutor>

	constructor(arg?: DflowNodeGraph) {
		super(arg)
		this.dataMap = new Map()
		this.subGraphInstanceById = new Map()
	}

	get data() {
		return Object.fromEntries(this.dataMap.entries())
	}

	addNodeGraph(
		nodeGraph: DflowNodeGraph,
		id = Dflow.generateId(),
	): DflowStepExecutor {
		const subGraph = new DflowStepExecutor(nodeGraph)
		// Sub graph inherits functions; do not override args and outs.
		for (const [parentFuncName, parentFunc] of this.funcByName.entries()) {
			if (
				!(nodeGraph.args ?? []).includes(parentFuncName) &&
				!(nodeGraph.outs ?? []).includes(parentFuncName) &&
				parentFunc
			) {
				const parentFuncArgs = this.argsByName.get(parentFuncName)
				if (parentFuncArgs) {
					subGraph.argsByName.set(parentFuncName, parentFuncArgs)
				}
				subGraph.funcByName.set(parentFuncName, parentFunc)
			}
		}
		this.subGraphInstanceById.set(id, subGraph)
		return subGraph
	}

	async run() {
		const nodeIds = this.nodeIds
		const pipes = this.pipes

		const levelOfNode: Record<DflowId, number> = {}
		for (const nodeId of nodeIds) {
			levelOfNode[nodeId] = Dflow.levelOfNode(nodeId, pipes)
		}
		nodeIds.sort((nodeIdA, nodeIdB) =>
			levelOfNode[nodeIdA] <= levelOfNode[nodeIdB] ? -1 : 1
		)

		for (const nodeId of nodeIds) {
			const nodeName = this.nodeNameById.get(nodeId)
			if (nodeName) {
				const graph = this.graphByName.get(nodeName)
				if (graph) {
					this.addNodeGraph(
						{
							name: nodeName,
							args: this.argsByName.get(nodeName),
							outs: this.outsByName.get(nodeName),
							...graph,
						},
						nodeId,
					)
				}
			}
		}

		NODES:
		for (const nodeId of nodeIds) {
			const nodeName = this.nodeNameById.get(nodeId)
			if (!nodeName) {
				continue NODES
			}
			const argValues: unknown[] = []

			const nodeArgNames = this.argsByName.get(nodeName)
			console.log("run node", nodeId, nodeName, nodeArgNames)

			if (nodeArgNames) {
				for (let position = 0; position < nodeArgNames.length; position++) {
					console.log(
						"position",
						position,
						"pin",
						Dflow.pinToId([nodeId, position]),
					)
					const pipe = this.pipeOfTargetId(Dflow.pinToId([nodeId, position]))
					console.log("pipe", pipe)
					if (pipe) {
						console.log("data", this.dataMap.get(Dflow.pinToId(pipe.from)))
						argValues.push(this.dataMap.get(Dflow.pinToId(pipe.from)))
					} else {
						argValues.push(undefined)
					}
				}
			}

			const func = this.funcByName.get(nodeName)

			if (func) {
				console.info(
					"execute func",
					`name=${nodeName}`,
					`id=${nodeId}`,
					`argValues=${argValues}`,
				)

				if (Dflow.isAsyncFunc(func)) {
					const data = await func.apply(null, argValues)
					this.dataMap.set(nodeId, data)
				} else if (Dflow.isFunc(func)) {
					console.log("func", nodeName, func, argValues)
					// const data = func.apply(null, argValues);
					// this.dataMap.set(nodeId, data);
				}
			}

			const subGraph = this.subGraphInstanceById.get(nodeId)

			if (subGraph) {
				console.info("execute graph", `name=${nodeName}`, `id=${nodeId}`)

				// 1. Set graph input values.
				if (nodeArgNames) {
					for (const subGraphNodeId of subGraph.nodeIds) {
						const nodeName = subGraph.nodeNameById.get(subGraphNodeId)
						if (nodeName) {
							for (
								let position = 0;
								position < nodeArgNames.length;
								position++
							) {
								if (nodeName === nodeArgNames[position]) {
									console.info(
										"set graph input",
										`name=${nodeName}`,
										`id=${subGraphNodeId}`,
										`value=${argValues[position]}`,
									)
									subGraph.dataMap.set(
										Dflow.pinToId([subGraphNodeId, position]),
										argValues[position],
									)
								}
							}
						}
					}
				}
				// 2. Execute graph.
				await subGraph.run()
				// 3. Get graph output values.
				const nodeOutNames = this.outsByName.get(nodeName)
				if (nodeOutNames) {
					for (const subGraphNodeId of subGraph.nodeIds) {
						const nodeName = subGraph.nodeNameById.get(subGraphNodeId)
						if (nodeName) {
							for (
								let position = 0;
								position < nodeOutNames.length;
								position++
							) {
								if (nodeName === nodeOutNames[position]) {
									const pipe = subGraph.pipeOfTargetId(subGraphNodeId)
									if (pipe) {
										console.info(
											"get graph output",
											`name=${nodeName}`,
											`id=${subGraphNodeId}`,
											`value=${subGraph.dataMap.get(Dflow.pinToId(pipe.from))}`,
										)
										this.dataMap.set(
											Dflow.pinToId([nodeId, position]),
											subGraph.dataMap.get(Dflow.pinToId(pipe.from)),
										)
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
