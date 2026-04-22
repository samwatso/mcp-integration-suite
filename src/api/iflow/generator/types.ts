export type AdapterType =
	| "HTTPS"
	| "HTTP"
	| "SOAP"
	| "IDOC"
	| "SFTP"
	| "AS2"
	| "RFC"
	| "MAIL"
	| "PROCESSDIRECT";

export type VersionProfile = "latest" | "compatible";

export type PatternName =
	| "generic-fallback"
	| "async-file-to-file"
	| "async-idoc-to-sftp"
	| "sync-soap-to-rest"
	| "pd-generic-mail-alert"
	| "pipeline-step07-outbound";

export interface AdapterProps {
	component: string;
	transport: string;
	message: string;
	variant_name: string;
	ns?: string;
}

export interface ResolvedAdapterProps {
	component_type: string;
	transport_protocol: string;
	message_protocol: string;
	cmd_variant_uri: string;
	component_ns: string;
	component_version: string;
	version: string;
}

export interface IdConfig {
	sender_address?: string;
	receiver_address?: string;
	sftp_sender_host?: string;
	sftp_sender_directory?: string;
	sftp_sender_filename?: string;
	sftp_receiver_host?: string;
	sftp_receiver_directory?: string;
	sftp_receiver_filename?: string;
	idoc_sender_host?: string;
	idoc_sender_client?: string;
	soap_sender_address?: string;
	soap_sender_wsdl?: string;
	http_receiver_address?: string;
	http_receiver_method?: string;
	http_receiver_auth_type?: string;
	[k: string]: unknown;
}

export interface EsrMetadata {
	mapping_type?: string;
	idoc_type?: string;
	[k: string]: unknown;
}

export interface InterfaceMeta {
	name: string;
	namespace?: string;
	direction?: string;
	sender_system?: string;
	receiver_system?: string;
	sender_adapter?: string;
	receiver_adapter?: string;
	mapping_reference?: string;
	operation_mapping?: string;
	message_type?: string;
	id_config?: IdConfig;
	id_config_json?: string | IdConfig;
	esr_metadata?: EsrMetadata;
	esr_metadata_json?: string | EsrMetadata;
}

export interface JobConfig {
	iflow_name_template?: string;
	mapping_strategy?: string;
	logging_enabled?: boolean;
	error_handling_enabled?: boolean;
	entry_scripts_enabled?: boolean;
	processdirect_address?: string;
	target_pattern?: string;
	cpi_version_profile?: VersionProfile;
	adapter_version_overrides?: Record<string, string>;
	description?: string;
	pattern_override?: PatternName;
}

export interface TemplateContext {
	iflow_name: string;
	iflow_id: string;
	namespace: string;
	description: string;
	generated_at: string;
	sender_system: string;
	receiver_system: string;
	sender_adapter_type: string;
	receiver_adapter_type: string;
	mapping_strategy: string;
	mapping_reference: string;
	mapping_type: string;
	sender_address: string;
	receiver_address: string;
	sftp_sender_host: string;
	sftp_sender_directory: string;
	sftp_sender_filename: string;
	sftp_receiver_host: string;
	sftp_receiver_directory: string;
	sftp_receiver_filename: string;
	idoc_type: string;
	idoc_sender_host: string;
	idoc_sender_client: string;
	soap_sender_address: string;
	soap_sender_wsdl: string;
	http_receiver_address: string;
	http_receiver_method: string;
	http_receiver_auth_type: string;
	logging_enabled: boolean;
	error_handling_enabled: boolean;
	processdirect_address: string;
	entry_scripts_enabled: boolean;
	needs_dynamic_endpoint: boolean;
	is_pipeline: boolean;
	pipeline_pd_address: string;
	sender_component_type: string;
	sender_transport_protocol: string;
	sender_message_protocol: string;
	sender_cmd_variant_uri: string;
	sender_component_ns: string;
	sender_component_version: string;
	sender_version: string;
	receiver_component_type: string;
	receiver_transport_protocol: string;
	receiver_message_protocol: string;
	receiver_cmd_variant_uri: string;
	receiver_component_ns: string;
	receiver_component_version: string;
	receiver_version: string;
	flowstep_versions: Record<string, string>;
	flowstep_component_versions: Record<string, string>;
	adapter_versions: Record<string, string>;
	[k: string]: unknown;
}

export interface IFlowRenderResult {
	zip_bytes: Buffer;
	pattern: PatternName;
	iflow_id: string;
	iflow_name: string;
	description: string;
	sender_system: string;
	receiver_system: string;
}
