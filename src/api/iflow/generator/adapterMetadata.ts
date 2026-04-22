import type { AdapterProps, ResolvedAdapterProps, VersionProfile } from "./types";

// Maps adapter type to CPI channel properties.
// HTTPS is sender-only in CPI — receivers must use HTTP adapter.
// Version numbers come from the SAP BTP adapter catalog.
export const CPI_ADAPTER_PROPS: Record<string, AdapterProps> = {
	HTTPS: { component: "HTTPS", transport: "HTTPS", message: "None", variant_name: "HTTPS" },
	HTTP: { component: "HTTP", transport: "HTTP", message: "None", variant_name: "HTTP" },
	SOAP: { component: "SOAP", transport: "HTTPS", message: "SOAP 1.x", variant_name: "SOAP" },
	IDOC: { component: "IDoc", transport: "HTTPS", message: "IDoc", variant_name: "IDOC" },
	SFTP: { component: "SFTP", transport: "SFTP", message: "File", variant_name: "SFTP" },
	AS2: { component: "AS2", transport: "HTTPS", message: "AS2", variant_name: "AS2" },
	RFC: { component: "RFC", transport: "RFC", message: "RFC", variant_name: "RFC" },
	MAIL: { component: "Mail", transport: "SMTP", message: "Mail", variant_name: "Mail" },
	PROCESSDIRECT: {
		component: "ProcessDirect",
		transport: "Not Applicable",
		message: "Not Applicable",
		variant_name: "ProcessDirect",
		ns: "",
	},
};

// "latest" for current Integration Suite tenants; "compatible" for older/trial runtimes.
export const CPI_VERSION_PROFILES: Record<VersionProfile, Record<string, string>> = {
	latest: {
		HTTPS: "1.9.0",
		HTTP: "1.20.0",
		SOAP: "1.14.0",
		IDOC: "1.11.0",
		SFTP: "1.19.0",
		AS2: "1.8.0",
		RFC: "1.5.0",
		MAIL: "1.9.1",
		PROCESSDIRECT: "1.1.2",
	},
	compatible: {
		HTTPS: "1.5.0",
		HTTP: "1.16.0",
		SOAP: "1.10.0",
		IDOC: "1.8.0",
		SFTP: "1.14.0",
		AS2: "1.5.0",
		RFC: "1.3.0",
		MAIL: "1.5.0",
		PROCESSDIRECT: "1.1.0",
	},
};

export const FLOWSTEP_VERSION_PROFILES: Record<VersionProfile, Record<string, string>> = {
	latest: {
		ErrorEventSubProcessTemplate: "1.1.0",
		Encoder: "1.3.0",
		Decoder: "1.3.0",
		ContentModifier: "1.5.0",
	},
	compatible: {
		ErrorEventSubProcessTemplate: "1.0.0",
		Encoder: "1.1.0",
		Decoder: "1.1.0",
		ContentModifier: "1.2.0",
	},
};

export function resolveAdapterProps(
	adapterType: string,
	direction: "Sender" | "Receiver",
	versionProfile: VersionProfile = "latest",
	versionOverrides?: Record<string, string>,
): ResolvedAdapterProps {
	const props = CPI_ADAPTER_PROPS[adapterType] ?? CPI_ADAPTER_PROPS["HTTPS"];
	const ns = props.ns === undefined ? "sap" : props.ns;
	const cname = ns ? `${ns}:${props.variant_name}` : props.variant_name;

	let version: string;
	if (versionOverrides && versionOverrides[adapterType]) {
		version = versionOverrides[adapterType];
	} else {
		const profileVersions = CPI_VERSION_PROFILES[versionProfile] ?? CPI_VERSION_PROFILES.latest;
		version = profileVersions[adapterType] ?? profileVersions.HTTPS ?? "1.9.0";
	}

	const cmd_variant_uri =
		`ctype::AdapterVariant/cname::${cname}` +
		`/tp::${props.transport}/mp::${props.message}` +
		`/direction::${direction}` +
		`/version::${version}`;

	const component_version = version.includes(".") ? version.replace(/\.[^.]+$/, "") : "1.0";

	return {
		component_type: props.component,
		transport_protocol: props.transport,
		message_protocol: props.message,
		cmd_variant_uri,
		component_ns: ns || props.variant_name,
		component_version,
		version,
	};
}
