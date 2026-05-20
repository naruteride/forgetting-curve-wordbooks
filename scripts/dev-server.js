import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { build } from "./build.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

/**
 * 개발용 정적 서버를 시작합니다.
 *
 * 서버는 먼저 `npm run build`와 동일한 빌드 과정을 실행한 뒤 `dist`를 제공합니다.
 * SPA 라우팅을 위해 존재하지 않는 경로는 `index.html`로 되돌립니다.
 *
 * @returns {Promise<void>} 서버 시작 후 종료되지 않는 Promise입니다.
 */
async function startServer() {
	await build();

	createServer(async (request, response) => {
		try {
			const requestUrl = new URL(request.url || "/", `http://localhost:${port}`);
			const unsafePath = decodeURIComponent(requestUrl.pathname);
			const cleanPath = normalize(unsafePath)
				.replace(/^(\.\.[/\\])+/, "")
				.replace(/^[/\\]+/, "");
			let filePath = resolve(distDir, cleanPath || "index.html");
			if (!filePath.startsWith(resolve(distDir))) {
				filePath = join(distDir, "index.html");
			}

			try {
				const fileStat = await stat(filePath);
				if (fileStat.isDirectory()) {
					filePath = join(filePath, "index.html");
				}
			} catch {
				filePath = join(distDir, "index.html");
			}

			const body = await readFile(filePath);
			response.writeHead(200, {
				"content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
				"cache-control": "no-store",
			});
			response.end(body);
		} catch (error) {
			response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
			response.end(error instanceof Error ? error.message : "서버 오류");
		}
	}).listen(port, () => {
		console.log(`http://localhost:${port}`);
	});
}

startServer().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
