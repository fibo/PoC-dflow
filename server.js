import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const fileExtensionToMimeTypeMap = new Map()
	.set("css", "text/css; charset=UTF-8")
	.set("html", "text/html; charset=UTF-8")
	.set("js", "application/javascript");

const PORT = process.env.PORT ?? 8000;

const STATIC_PATH = path.resolve(process.cwd());

http.createServer(async (req, res) => {
	const pathParts = [STATIC_PATH, req.url];
	if (req.url.endsWith("/")) pathParts.push("index.html");
	const filePath = path.join(...pathParts);

	const exists = await fs.promises.access(filePath).then(
		() => true,
		() => false,
	);

	const sendText = (statusCode, text) => {
		res.writeHead(statusCode, {
			"Content-Type": "text/html; charset=utf-8",
		});
		res.end(text);
	};

	if (!exists) return sendText(404, "NOT FOUND");

	const stream = fs.createReadStream(filePath);
	const fileExtension = path.extname(filePath).substring(1).toLowerCase();
	const mimeType = fileExtensionToMimeTypeMap.get(fileExtension);

	if (!mimeType) return sendText(501, "NOT IMPLEMENTED");

	res.writeHead(200, { "Content-Type": mimeType });
	stream.pipe(res);
}).listen(PORT);
