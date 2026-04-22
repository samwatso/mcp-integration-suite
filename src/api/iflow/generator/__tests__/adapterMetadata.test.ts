import { resolveAdapterProps } from "../adapterMetadata";

describe("resolveAdapterProps", () => {
	it("returns HTTPS props for unknown adapter type (fallback)", () => {
		const r = resolveAdapterProps("NOT_A_REAL_ADAPTER", "Sender");
		expect(r.component_type).toBe("HTTPS");
		expect(r.version).toBe("1.9.0");
	});

	it("returns SFTP latest profile version", () => {
		const r = resolveAdapterProps("SFTP", "Sender", "latest");
		expect(r.component_type).toBe("SFTP");
		expect(r.version).toBe("1.19.0");
	});

	it("returns SFTP compatible profile version", () => {
		const r = resolveAdapterProps("SFTP", "Sender", "compatible");
		expect(r.version).toBe("1.14.0");
	});

	it("uses version override when provided", () => {
		const r = resolveAdapterProps("SOAP", "Sender", "latest", { SOAP: "9.9.9" });
		expect(r.version).toBe("9.9.9");
	});

	it("encodes direction into cmd_variant_uri", () => {
		const sender = resolveAdapterProps("HTTP", "Sender");
		const receiver = resolveAdapterProps("HTTP", "Receiver");
		expect(sender.cmd_variant_uri).toContain("direction::Sender");
		expect(receiver.cmd_variant_uri).toContain("direction::Receiver");
	});

	it("handles PROCESSDIRECT with empty namespace (no sap: prefix)", () => {
		const r = resolveAdapterProps("PROCESSDIRECT", "Sender");
		expect(r.cmd_variant_uri).toContain("cname::ProcessDirect");
		expect(r.cmd_variant_uri).not.toContain("cname::sap:ProcessDirect");
	});

	it("truncates version to major.minor for component_version", () => {
		const r = resolveAdapterProps("HTTP", "Sender", "latest");
		expect(r.version).toBe("1.20.0");
		expect(r.component_version).toBe("1.20");
	});
});
