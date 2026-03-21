import path from 'path';
// projPath must be set before any handler imports that reference it
export { projPath } from './serverUtils';

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAllHandlers } from './handlers';
import { config } from 'dotenv';
import { McpServerWithMiddleware } from './utils/middleware';
import { logInfo, logError } from './serverUtils';
import './utils/logging';
import { registerDeleteTempOnExit } from './utils/exitHandler';
import { exit } from 'process';

config({ path: path.join(__dirname, '..', '.env') });

process.on('uncaughtException', (err) => {
	logError(err);
	exit(2);
});

registerDeleteTempOnExit();

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
	res.json({ status: 'ok', service: 'mcp-integration-suite' });
});

// Stateless Streamable HTTP: new server+transport per request
app.post('/mcp', async (req, res) => {
	const server = new McpServerWithMiddleware(
		{ name: 'integration-suite', version: '1.0.0' },
		{ capabilities: { tools: {} } },
	);
	registerAllHandlers(server);

	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});

	res.on('close', () => transport.close().catch(() => {}));

	try {
		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
	} catch (err) {
		logError(err);
		if (!res.headersSent) {
			res.status(500).json({ error: 'Internal server error' });
		}
	}
});

const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
	logInfo(`mcp-integration-suite HTTP server listening on port ${port}`);
	console.log(`mcp-integration-suite HTTP server listening on port ${port}`);
});
