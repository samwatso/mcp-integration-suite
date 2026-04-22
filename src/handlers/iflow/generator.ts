import { z } from "zod";
import { McpServerWithMiddleware } from "../../utils/middleware";
import { logError, logInfo } from "../../serverUtils";
import { formatError } from "../../utils/customErrHandler";
import { renderIflowZip } from "../../api/iflow/generator/renderer";
import { PATTERNS, PATTERN_DESCRIPTIONS } from "../../api/iflow/generator/patternSelector";
import type {
	InterfaceMeta,
	JobConfig,
	PatternName,
	VersionProfile,
} from "../../api/iflow/generator/types";

const patternEnum = z.enum([
	"generic-fallback",
	"async-file-to-file",
	"async-idoc-to-sftp",
	"sync-soap-to-rest",
	"pd-generic-mail-alert",
	"pipeline-step07-outbound",
]);

const idConfigSchema = z
	.object({
		sender_address: z.string().optional(),
		receiver_address: z.string().optional(),
		sftp_sender_host: z.string().optional(),
		sftp_sender_directory: z.string().optional(),
		sftp_sender_filename: z.string().optional(),
		sftp_receiver_host: z.string().optional(),
		sftp_receiver_directory: z.string().optional(),
		sftp_receiver_filename: z.string().optional(),
		idoc_sender_host: z.string().optional(),
		idoc_sender_client: z.string().optional(),
		soap_sender_address: z.string().optional(),
		soap_sender_wsdl: z.string().optional(),
		http_receiver_address: z.string().optional(),
		http_receiver_method: z.string().optional(),
		http_receiver_auth_type: z.string().optional(),
	})
	.passthrough()
	.optional();

const esrMetadataSchema = z
	.object({
		mapping_type: z.string().optional(),
		idoc_type: z.string().optional(),
	})
	.passthrough()
	.optional();

export const registerIflowGeneratorHandlers = (server: McpServerWithMiddleware) => {
	server.registerToolIntegrationSuite(
		"list-iflow-patterns",
		`List available iFlow generation patterns. Use this before generate-iflow to see which pattern matches your scenario, or pass pattern_override to force one.`,
		{},
		async () => {
			const patterns = PATTERNS.map((name) => ({
				name,
				description: PATTERN_DESCRIPTIONS[name],
			}));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ patterns }, null, 2),
					},
				],
			};
		},
	);

	server.registerToolIntegrationSuite(
		"generate-iflow",
		`Generate a production-ready iFlow ZIP from a template pattern. Returns the ZIP as base64.
The ZIP can be imported into Integration Suite directly, or its contents (iflow.iflw, parameters, scripts, MANIFEST.MF) can be written into an existing iFlow via update-iflow.

Pattern is auto-selected from sender/receiver adapter types unless pattern_override is provided.
Available patterns: generic-fallback, async-file-to-file, async-idoc-to-sftp, sync-soap-to-rest, pd-generic-mail-alert, pipeline-step07-outbound.
Use list-iflow-patterns first if unsure.

The MANIFEST.MF is JAR-spec formatted (72-byte line folding, CRLF). Adapter versions default to the "latest" profile — use cpi_version_profile="compatible" for older/trial runtimes, or adapter_version_overrides to pin specific versions detected on the tenant.

Supported sender/receiver adapter types: HTTPS, HTTP, SOAP, IDOC, SFTP, AS2, RFC, MAIL, PROCESSDIRECT. HTTPS is sender-only — receiver HTTPS is coerced to HTTP.`,
		{
			name: z.string().describe("Interface / iFlow base name. Used to derive iflow_id (non-alphanumerics replaced with underscore)."),
			namespace: z.string().optional().describe("iFlow namespace. Defaults to urn:mcp:default."),
			direction: z.enum(["sync", "async"]).optional().describe("sync or async. Affects pattern selection (SOAP sync → sync-soap-to-rest)."),
			sender_system: z.string().optional(),
			receiver_system: z.string().optional(),
			sender_adapter: z.string().optional().describe("Adapter type e.g. HTTPS, SOAP, SFTP, IDOC. Case-insensitive."),
			receiver_adapter: z.string().optional().describe("Adapter type. HTTPS is auto-coerced to HTTP on receiver side."),
			mapping_reference: z.string().optional().describe("Reference to a message mapping. TODO_mapping if omitted."),
			operation_mapping: z.string().optional(),
			message_type: z.string().optional().describe("e.g. ORDERS05 for IDoc patterns."),
			id_config: idConfigSchema.describe("Channel-specific addresses (SFTP host/dir/filename, HTTP receiver URL, etc.)."),
			esr_metadata: esrMetadataSchema,
			job_config: z
				.object({
					iflow_name_template: z.string().optional().describe('Defaults to "{name}". Supports {name} and {direction}.'),
					mapping_strategy: z.string().optional(),
					logging_enabled: z.boolean().optional().describe("Bundle PayloadLogger + legacy log scripts. Default false."),
					error_handling_enabled: z.boolean().optional().describe("Bundle error handling scripts. Default true."),
					entry_scripts_enabled: z.boolean().optional().describe("Bundle SizeGuard + ReplaySnapshot entry scripts. Default false."),
					processdirect_address: z.string().optional().describe("ProcessDirect address for error alerting. Default /utils/common/sendMail."),
					target_pattern: z.string().optional().describe('Set to "generic-pipeline" or "adapter-pipeline" to emit a Step-07 pipeline iFlow.'),
					cpi_version_profile: z.enum(["latest", "compatible"]).optional().describe('Default "latest". Use "compatible" for trial/older tenants.'),
					adapter_version_overrides: z.record(z.string(), z.string()).optional().describe("Per-adapter version pins, e.g. {SFTP: \"1.14.0\"}."),
					description: z.string().optional().describe("iFlow description. Default: \"Generated iFlow: <name>\"."),
					pattern_override: patternEnum.optional().describe("Force a specific pattern; skips automatic selection."),
				})
				.optional(),
		},
		async (input) => {
			try {
				const iface: InterfaceMeta = {
					name: input.name,
					namespace: input.namespace,
					direction: input.direction,
					sender_system: input.sender_system,
					receiver_system: input.receiver_system,
					sender_adapter: input.sender_adapter,
					receiver_adapter: input.receiver_adapter,
					mapping_reference: input.mapping_reference,
					operation_mapping: input.operation_mapping,
					message_type: input.message_type,
					id_config: input.id_config,
					esr_metadata: input.esr_metadata,
				};
				const jobConfig: JobConfig = {
					iflow_name_template: input.job_config?.iflow_name_template,
					mapping_strategy: input.job_config?.mapping_strategy,
					logging_enabled: input.job_config?.logging_enabled,
					error_handling_enabled: input.job_config?.error_handling_enabled,
					entry_scripts_enabled: input.job_config?.entry_scripts_enabled,
					processdirect_address: input.job_config?.processdirect_address,
					target_pattern: input.job_config?.target_pattern,
					cpi_version_profile: input.job_config?.cpi_version_profile as VersionProfile | undefined,
					adapter_version_overrides: input.job_config?.adapter_version_overrides,
					description: input.job_config?.description,
					pattern_override: input.job_config?.pattern_override as PatternName | undefined,
				};

				logInfo(`generate-iflow: name=${iface.name} pattern_override=${jobConfig.pattern_override ?? "(auto)"}`);

				const result = renderIflowZip(iface, jobConfig);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								type: "success",
								pattern: result.pattern,
								iflow_id: result.iflow_id,
								iflow_name: result.iflow_name,
								description: result.description,
								sender_system: result.sender_system,
								receiver_system: result.receiver_system,
								zip_size_bytes: result.zip_bytes.length,
								zip_base64: result.zip_bytes.toString("base64"),
							}),
						},
					],
				};
			} catch (error) {
				logError(error);
				return {
					isError: true,
					content: [formatError(error)],
				};
			}
		},
	);
};
