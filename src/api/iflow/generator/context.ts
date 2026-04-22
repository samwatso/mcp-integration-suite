import type {
	IdConfig,
	EsrMetadata,
	InterfaceMeta,
	JobConfig,
	TemplateContext,
	VersionProfile,
} from "./types";
import {
	CPI_VERSION_PROFILES,
	FLOWSTEP_VERSION_PROFILES,
	resolveAdapterProps,
} from "./adapterMetadata";

function coerceObject<T extends object>(raw: unknown): T {
	if (raw == null) return {} as T;
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			return (parsed && typeof parsed === "object" ? parsed : {}) as T;
		} catch {
			return {} as T;
		}
	}
	if (typeof raw === "object") return raw as T;
	return {} as T;
}

function sanitizeName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sanitizeId(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function truncatePatch(version: string): string {
	if (!version) return "1.0";
	const idx = version.lastIndexOf(".");
	return idx === -1 ? version : version.slice(0, idx);
}

export function buildTemplateContext(
	iface: InterfaceMeta,
	jobConfig: JobConfig,
	versionProfile: VersionProfile = "latest",
	adapterVersionOverrides?: Record<string, string>,
): TemplateContext {
	const safeName = sanitizeName(iface.name ?? "unknown");

	const idConfig: IdConfig = coerceObject<IdConfig>(
		iface.id_config ?? iface.id_config_json,
	);
	const esrMetadata: EsrMetadata = coerceObject<EsrMetadata>(
		iface.esr_metadata ?? iface.esr_metadata_json,
	);

	const nameTemplate = jobConfig.iflow_name_template ?? "{name}";
	const direction = iface.direction ?? "";
	let iflowName = nameTemplate
		.replace("{name}", safeName)
		.replace("{direction}", direction);
	iflowName = iflowName.replace(/[_-]+$/, "");
	const iflowId = sanitizeId(iflowName);

	const description =
		jobConfig.description ??
		`Generated iFlow: ${iface.name ?? "unknown"}`;

	// HTTPS is sender-only in CPI — receiver defaults to HTTP.
	let senderAdapterType = (iface.sender_adapter ?? "HTTPS").toUpperCase();
	let receiverAdapterType = (iface.receiver_adapter ?? "HTTP").toUpperCase();
	if (receiverAdapterType === "HTTPS") receiverAdapterType = "HTTP";

	const needsDynamicEndpoint =
		receiverAdapterType === "SFTP" || receiverAdapterType === "FILE";

	const targetPattern = jobConfig.target_pattern ?? "p2p-async";
	const isPipeline =
		targetPattern === "generic-pipeline" || targetPattern === "adapter-pipeline";

	const senderProps = resolveAdapterProps(
		senderAdapterType,
		"Sender",
		versionProfile,
		adapterVersionOverrides,
	);
	const receiverProps = resolveAdapterProps(
		receiverAdapterType,
		"Receiver",
		versionProfile,
		adapterVersionOverrides,
	);

	const flowstepFull =
		FLOWSTEP_VERSION_PROFILES[versionProfile] ?? FLOWSTEP_VERSION_PROFILES.latest;
	const flowstepComponentVersions: Record<string, string> = {};
	for (const [k, v] of Object.entries(flowstepFull)) {
		flowstepComponentVersions[k] = truncatePatch(v);
	}

	const adapterVersions: Record<string, string> = {
		...(CPI_VERSION_PROFILES[versionProfile] ?? CPI_VERSION_PROFILES.latest),
	};
	if (adapterVersionOverrides) Object.assign(adapterVersions, adapterVersionOverrides);

	return {
		iflow_name: iflowName,
		iflow_id: iflowId,
		namespace: iface.namespace ?? "urn:mcp:default",
		description,
		generated_at: new Date().toISOString(),

		sender_system: iface.sender_system ?? "SenderSystem",
		receiver_system: iface.receiver_system ?? "ReceiverSystem",
		sender_adapter_type: senderAdapterType,
		receiver_adapter_type: receiverAdapterType,

		mapping_strategy: jobConfig.mapping_strategy ?? "port",
		mapping_reference:
			iface.mapping_reference ?? iface.operation_mapping ?? "TODO_mapping",
		mapping_type: (esrMetadata.mapping_type as string) ?? "MessageMapping",

		sender_address: (idConfig.sender_address as string) ?? "",
		receiver_address: (idConfig.receiver_address as string) ?? "",

		sftp_sender_host: (idConfig.sftp_sender_host as string) ?? "",
		sftp_sender_directory: (idConfig.sftp_sender_directory as string) ?? "",
		sftp_sender_filename: (idConfig.sftp_sender_filename as string) ?? "",
		sftp_receiver_host: (idConfig.sftp_receiver_host as string) ?? "",
		sftp_receiver_directory: (idConfig.sftp_receiver_directory as string) ?? "",
		sftp_receiver_filename: (idConfig.sftp_receiver_filename as string) ?? "",

		idoc_type:
			(esrMetadata.idoc_type as string) ?? iface.message_type ?? "",
		idoc_sender_host: (idConfig.idoc_sender_host as string) ?? "",
		idoc_sender_client: (idConfig.idoc_sender_client as string) ?? "",

		soap_sender_address: (idConfig.soap_sender_address as string) ?? "",
		soap_sender_wsdl: (idConfig.soap_sender_wsdl as string) ?? "",

		http_receiver_address: (idConfig.http_receiver_address as string) ?? "",
		http_receiver_method: (idConfig.http_receiver_method as string) ?? "POST",
		http_receiver_auth_type: (idConfig.http_receiver_auth_type as string) ?? "",

		logging_enabled: jobConfig.logging_enabled ?? false,
		error_handling_enabled: jobConfig.error_handling_enabled ?? true,
		processdirect_address:
			jobConfig.processdirect_address ?? "/utils/common/sendMail",
		entry_scripts_enabled: jobConfig.entry_scripts_enabled ?? false,

		needs_dynamic_endpoint: needsDynamicEndpoint,
		is_pipeline: isPipeline,
		pipeline_pd_address: isPipeline ? `/pip/${iflowId}_outbound` : "",

		sender_component_type: senderProps.component_type,
		sender_transport_protocol: senderProps.transport_protocol,
		sender_message_protocol: senderProps.message_protocol,
		sender_cmd_variant_uri: senderProps.cmd_variant_uri,
		sender_component_ns: senderProps.component_ns,
		sender_component_version: senderProps.component_version,
		sender_version: senderProps.version,

		receiver_component_type: receiverProps.component_type,
		receiver_transport_protocol: receiverProps.transport_protocol,
		receiver_message_protocol: receiverProps.message_protocol,
		receiver_cmd_variant_uri: receiverProps.cmd_variant_uri,
		receiver_component_ns: receiverProps.component_ns,
		receiver_component_version: receiverProps.component_version,
		receiver_version: receiverProps.version,

		flowstep_versions: flowstepFull,
		flowstep_component_versions: flowstepComponentVersions,
		adapter_versions: adapterVersions,
	};
}
