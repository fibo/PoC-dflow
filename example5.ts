// import { Dflow } from "./dflow.js";
import { DflowExecutor } from "./executor.js"

const dflow = new DflowExecutor()

dflow.setNodeFunc({
	name: "counter",
	code: ["let n = 0", "return () => {", "n += 1", "this.emit(n)", "}"]
})

dflow.context.set("counter", dflow)

dflow.setNodeFunc({
	name: "setInterval",
	args: ["func"],
	code: [
		"const intervalId = setInterval(func, 1000)",
		"this.stop(() => { clearInterval(intervalId)})"
	]
})

const nodeId1 = "id1"
const nodeId2 = "id2"
dflow.addNode("counter", nodeId1)
dflow.addNode("setInterval", nodeId2)
dflow.addPipe({ from: nodeId1, to: nodeId2 })

await dflow.run()

setTimeout(() => {
	dflow.stop()
}, 2000)
