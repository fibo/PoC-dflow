import { readdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const baseDir = resolve(dirname(fileURLToPath(import.meta.url)))
const htmlDir = join(baseDir, "html")

try {
	const files = await readdir(htmlDir)
	for (const file of files)
		if (extname(file) === ".html") {
			const filename = basename(file, ".html")
			const content = await readFile(join(htmlDir, file), "utf-8")
			await writeFile(
				join(htmlDir, `${filename}.ts`),
				`export default '${content
					.replace(/\t/g, "")
					.replace(/\n/g, "")
					.replace(/:\s/g, ":")}'`,
				"utf-8"
			)
		}
} catch (err) {
	console.error(err)
}
