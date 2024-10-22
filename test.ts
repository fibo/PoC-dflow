import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { describe, test } from "node:test"
import { Dflow } from "./dflow.js"

test("dflow.js", async () => {
	const content = await readFile("dflow.js", "utf-8")
	assert.ok(
		content.startsWith("/** https://github.com/fibo/dflow @license MIT */")
	)
})

describe("Dflow", () => {
	describe("context = new Map<Dflow.NodeId | Dflow.Name, unknown>()", () => {
		test("context by node id takes precedence over context by node name", async () => {
			const nodeId = "id1"
			const nodeName = "hello"
			const message = "hello world"

			class MyDflow extends Dflow {
				test(id: Dflow.NodeId, msg: string) {
					assert.equal(nodeId, id)
					assert.equal(message, msg)
				}

				addNode(
					name: Dflow.Node["name"],
					id: Dflow.NodeId
				): Dflow.NodeId {
					this.context.set(id, { test: this.test.bind(null, id) })
					return super.addNode(name, id)
				}
			}

			const dflow = new MyDflow()

			dflow.setNodeFunc({
				name: nodeName,
				code: `this.test("${message}")`
			})
			// If this context were used it would raise an AssertionError,
			// cause node id is not passed as argument.
			dflow.context.set(nodeName, dflow.test.bind(null))
			dflow.addNode(nodeName, nodeId)

			await dflow.run()
		})
	})

	describe("constructor({ name, args, outs, nodes, pipes }: Dflow.NodeGraph)", () => {
		test("no arg default to empty Dflow.NodeGraph", () => {
			const dflow = new Dflow()

			const { args, nodes, pipes, outs } = dflow.toValue()

			assert.equal(dflow.name, "")
			assert.equal(args, undefined)
			assert.equal(outs, undefined)
			assert.equal(nodes.length, 0)
			assert.equal(pipes.length, 0)
		})
	})

	describe("*parentNodeIds(nodeId: Dflow.NodeId): Generator<Dflow.NodeId>", () => {
		test("return nodeIds of parent nodes", () => {
			const dflow = new Dflow()
			dflow.setNodeFunc({
				name: "sum",
				args: ["a", "b"],
				code: "return a + b"
			})
			dflow.addNode("sum", "level0_1")
			dflow.addNode("sum", "level0_2")
			dflow.addNode("sum", "level1_1")
			dflow.addPipe({ from: "level0_1", to: ["level1_1", 0] })
			dflow.addPipe({ from: "level0_2", to: ["level1_1", 1] })
			const parentNodeIds = new Set(["level0_1", "level0_2"])
			for (let nodeId of dflow.parentNodeIds("level1_1")) {
				assert.ok(["level0_1", "level0_2"].includes(nodeId))
				parentNodeIds.delete(nodeId)
			}
			assert.equal(parentNodeIds.size, 0)
		})
	})

	describe("run()", () => {
		test("executes node funcs", async () => {
			const dflow = new Dflow()

			dflow.setNodeFunc({
				name: "sum",
				args: ["a", "b"],
				code: "return a + b"
			})
			dflow.setNodeFunc({ name: "PI", code: "return Math.PI" })
			dflow.setNodeFunc({ name: "E", code: "return Math.E" })

			dflow.addNode("PI", "id1")
			dflow.addNode("E", "id2")
			dflow.addNode("sum", "id3")

			dflow.addPipe({ from: "id1", to: ["id3", 0] })
			dflow.addPipe({ from: "id2", to: ["id3", 1] })

			await dflow.run()

			assert.equal(dflow.out.get("id3"), Math.PI + Math.E)
		})
	})

	describe("runFunc(nodeId: Dflow.NodeId, func: Dflow.Func | undefined, context?: unknown)", () => {
		test("func can be undefined", async () => {
			const errorMessage = "failed"
			function fail() {
				throw new Error(errorMessage)
			}
			const dflow = new Dflow()
			const nodeId = "id"
			const nodeName = "fail"
			dflow.setFunc(nodeName, fail)
			dflow.addNode(nodeName, nodeId)
			// Check that running the `fail` function actually throws an error.
			await assert.rejects(
				async () => {
					await dflow.runFunc(nodeId, fail)
				},
				{
					name: Dflow.Error.NodeExecution.errorName,
					message: Dflow.Error.NodeExecution.message(
						nodeId,
						nodeName,
						errorMessage
					)
				}
			)
			// Running the same nodeId but with no func will not throw.
			await assert.doesNotReject(async () => {
				await dflow.runFunc(nodeId, undefined)
			}, Error)
		})
	})

	describe("setFunc(name: Dflow.Name, func: Dflow.Func, args?: Dflow.Args)", () => {
		test("args default to ['arg0', ..., 'argn'] according to func.length", () => {
			function ok(arg1: any, arg2: any) {
				assert.ok(arg1)
				assert.ok(arg2)
			}

			const dflow = new Dflow()

			dflow.setNodeFunc({
				name: "true",
				code: "return true"
			})

			dflow.setFunc("ok", ok)
			assert.deepEqual(dflow.nodeArgs.get("ok"), ["arg0", "arg1"])

			const nodeId1 = "id1"
			dflow.addNode("true", nodeId1)
			const nodeId2 = "id2"
			dflow.addNode("ok", nodeId2)
			dflow.addPipe({ from: nodeId1, to: [nodeId2, 0] })
			dflow.addPipe({ from: nodeId1, to: [nodeId2, 1] })

			// This will run asserts in `ok` function
			dflow.run()
		})
	})

	describe("toString()", () => {
		test("displays name and num of args, outs, nodes, pipes", () => {
			const dflow = new Dflow()
			dflow.name = "test"

			const PI: Dflow.NodeFunc = {
				name: "Math.PI",
				code: "return Math.PI"
			}

			dflow.setNodeFunc({
				name: "Math.sin",
				args: ["arg"],
				code: "return Math.sin(arg)"
			})

			dflow.setNodeFunc(PI)

			dflow.addNode("Math.PI", "nodeId1")
			dflow.addNode("Math.sin", "nodeId2")

			dflow.addPipe({ from: "nodeId1", to: "nodeId2" })
			assert.equal(
				dflow.toString(),
				"Dflow name=test args=0 nodes=2 pipes=1 outs=0"
			)
		})
	})

	describe("funcBody(code: Dflow.Code): string", () => {
		test("if code is a string, it return same code", () => {
			assert.equal(Dflow.funcBody("some code"), "some code")
		})

		test("if code is an array of strings, it return code joined by semicolons", () => {
			assert.equal(
				Dflow.funcBody(["code row1", "code row2"]),
				"code row1;code row2"
			)
		})
	})

	describe('static isBrokenPipe(pipe: Dflow.Pipe, node: Dflow["node"])', () => {
		test("return false if nodes can be connected", () => {
			const node: Dflow["node"] = new Map()
			const nodeId1 = "a"
			const nodeId2 = "b"

			node.set(nodeId1, "name")
			node.set(nodeId2, "name")
			assert.equal(
				Dflow.isBrokenPipe({ from: nodeId1, to: nodeId2 }, node),
				false
			)
		})
	})
})
