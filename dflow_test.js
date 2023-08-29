import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("dflow.js", async () => {
	const content = await readFile("dflow.js", "utf-8");
	assert.ok(
		content.startsWith("/** https://github.com/fibo/dflow @license MIT */"),
	);
});
