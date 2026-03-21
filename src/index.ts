// projPath, logError, logInfo exported from serverUtils to avoid circular deps with server.ts
export { projPath, logError, logInfo } from "./serverUtils";
import { projPath, logError, logInfo } from "./serverUtils";

import path from "path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllHandlers } from "./handlers";
import { config } from "dotenv";

import { exit } from "process";
import "./utils/logging";
import { writeToLog } from "./utils/logging";
import { McpServerWithMiddleware } from "./utils/middleware";
import './utils/exitHandler';
import { registerDeleteTempOnExit } from "./utils/exitHandler";

process.on("uncaughtException", (err) => {
	logError(err);
	exit(2);
});

config({ path: path.join(projPath, ".env") });

const server = new McpServerWithMiddleware({
	name: "integration-suite",
	version: "1.0.0",
}, {
	capabilities: {
		resources: {},
		tools: {},
	},
});

registerAllHandlers(server);

async function main() {
	registerDeleteTempOnExit();
	const transport = new StdioServerTransport();

	await server.connect(transport);
}


if (!process.env.JEST_WORKER_ID) {
	main()
		.catch((err) => {
			logError(err);
			console.error(err);
			exit(1);
		})
		.then(() => writeToLog("server started"));

}
