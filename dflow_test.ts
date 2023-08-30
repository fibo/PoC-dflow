import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { Dflow } from "./dflow.js";
import { DflowStepExecutor } from "./step-executor.js";

test("dflow.js", async () => {
	const content = await readFile("dflow.js", "utf-8");
	assert.ok(
		content.startsWith("/** https://github.com/fibo/dflow @license MIT */"),
	);
});

test("Dflow.toString()", () => {
	const dflow = new Dflow();
	dflow.name = "test";

	const PI: Dflow.NodeFunc = {
		name: "Math.PI",
		code: "return Math.PI",
	};

	dflow.setNodeFunc({
		name: "Math.sin",
		args: ["arg"],
		code: "return Math.sin(arg)",
	});

	dflow.setNodeFunc(PI);

	dflow.addNode("Math.PI", "nodeId1");
	dflow.addNode("Math.sin", "nodeId2");

	dflow.addPipe({ from: "nodeId1", to: "nodeId2" });
	assert.equal(
		dflow.toString(),
		"Dflow name=test args=0 nodes=2 pipes=1 outs=0",
	);
});

describe("setFunc(name: Dflow.Name, func: Dflow.Func, args?: Dflow.Args)", () => {
	test("args default to ['arg0', ..., 'argn'] according to func.length");
	function ok(arg1: any, arg2: any) {
		assert.ok(arg1);
		assert.ok(arg2);
	}

	const dflow = new DflowStepExecutor();

	dflow.setNodeFunc({
		name: "true",
		code: "return true",
	});

	dflow.setFunc("ok", ok);
	assert.deepEqual(dflow.nodeArgs.get("ok"), ["arg0", "arg1"]);

	const nodeId1 = dflow.addNode("true");
	const nodeId2 = dflow.addNode("ok");
	dflow.addPipe({ from: nodeId1, to: nodeId2 });
	dflow.addPipe({ from: nodeId1, to: [nodeId2, 1] });

	// This will run asserts in `ok` function
	dflow.run();
});
