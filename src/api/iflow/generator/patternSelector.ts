import type { InterfaceMeta, JobConfig, PatternName } from "./types";

export const PATTERNS: readonly PatternName[] = [
	"generic-fallback",
	"async-file-to-file",
	"async-idoc-to-sftp",
	"sync-soap-to-rest",
	"pd-generic-mail-alert",
	"pipeline-step07-outbound",
] as const;

export const PATTERN_DESCRIPTIONS: Record<PatternName, string> = {
	"generic-fallback": "Generic passthrough with optional mapping; use when no specialized pattern fits.",
	"async-file-to-file": "Asynchronous file/SFTP sender to file/SFTP receiver with optional mapping.",
	"async-idoc-to-sftp": "Asynchronous IDoc sender to SFTP/file receiver.",
	"sync-soap-to-rest": "Synchronous SOAP sender to HTTP/REST receiver.",
	"pd-generic-mail-alert": "ProcessDirect-invoked generic mail alert sub-flow for error notification.",
	"pipeline-step07-outbound": "SAP CI Pipeline framework Step 07 outbound iFlow.",
};

export function selectTemplatePattern(
	iface: InterfaceMeta,
	jobConfig?: JobConfig,
): PatternName {
	// Explicit override wins.
	if (jobConfig?.pattern_override && PATTERNS.includes(jobConfig.pattern_override)) {
		return jobConfig.pattern_override;
	}

	// Pipeline framework output.
	const targetPattern = jobConfig?.target_pattern ?? "";
	if (targetPattern === "generic-pipeline" || targetPattern === "adapter-pipeline") {
		return "pipeline-step07-outbound";
	}

	const sender = (iface.sender_adapter ?? "").toLowerCase();
	const receiver = (iface.receiver_adapter ?? "").toLowerCase();
	const direction = (iface.direction ?? "").toLowerCase();

	if (sender.includes("idoc")) {
		return "async-idoc-to-sftp";
	}

	const senderIsFile = sender.includes("sftp") || sender.includes("file");
	const receiverIsFile = receiver.includes("sftp") || receiver.includes("file");
	if (senderIsFile && receiverIsFile) {
		return "async-file-to-file";
	}
	if (senderIsFile) {
		return "async-file-to-file";
	}

	if (sender.includes("soap") && direction === "sync") {
		return "sync-soap-to-rest";
	}
	if (sender.includes("soap") && (receiver.includes("http") || receiver.includes("rest"))) {
		return "sync-soap-to-rest";
	}

	return "generic-fallback";
}
