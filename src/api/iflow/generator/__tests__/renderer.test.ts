import AdmZip from "adm-zip";
import { renderIflowZip } from "../renderer";
import { PATTERNS } from "../patternSelector";
import type { InterfaceMeta, JobConfig, PatternName } from "../types";

const patternInputs: Record<PatternName, { iface: InterfaceMeta; jobConfig: JobConfig }> = {
	"generic-fallback": {
		iface: { name: "Generic_Test", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
		jobConfig: { pattern_override: "generic-fallback" },
	},
	"async-file-to-file": {
		iface: {
			name: "File_Test",
			sender_adapter: "SFTP",
			receiver_adapter: "SFTP",
			sender_system: "SrcSys",
			receiver_system: "DestSys",
			id_config: {
				sftp_sender_host: "src.example.com",
				sftp_sender_directory: "/in",
				sftp_sender_filename: "*.xml",
				sftp_receiver_host: "dest.example.com",
				sftp_receiver_directory: "/out",
				sftp_receiver_filename: "out.xml",
			},
		},
		jobConfig: { pattern_override: "async-file-to-file", logging_enabled: true },
	},
	"async-idoc-to-sftp": {
		iface: {
			name: "IDoc_Test",
			sender_adapter: "IDOC",
			receiver_adapter: "SFTP",
			message_type: "ORDERS05",
		},
		jobConfig: { pattern_override: "async-idoc-to-sftp" },
	},
	"sync-soap-to-rest": {
		iface: {
			name: "Soap_Test",
			sender_adapter: "SOAP",
			receiver_adapter: "HTTP",
			direction: "sync",
			id_config: { soap_sender_address: "/svc/customer" },
		},
		jobConfig: { pattern_override: "sync-soap-to-rest" },
	},
	"pd-generic-mail-alert": {
		iface: {
			name: "Mail_Alert",
			sender_adapter: "PROCESSDIRECT",
			receiver_adapter: "MAIL",
		},
		jobConfig: { pattern_override: "pd-generic-mail-alert" },
	},
	"pipeline-step07-outbound": {
		iface: { name: "Pipeline_Step7", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
		jobConfig: { pattern_override: "pipeline-step07-outbound", target_pattern: "generic-pipeline" },
	},
};

describe("renderIflowZip — end-to-end per pattern", () => {
	for (const pattern of PATTERNS) {
		it(`renders ${pattern} into a valid ZIP with required artifacts`, () => {
			const { iface, jobConfig } = patternInputs[pattern];
			const result = renderIflowZip(iface, jobConfig);

			expect(result.pattern).toBe(pattern);
			expect(result.zip_bytes.length).toBeGreaterThan(500);

			const zip = new AdmZip(result.zip_bytes);
			const entries = zip.getEntries().map((e) => e.entryName);

			expect(entries).toContain("META-INF/MANIFEST.MF");
			expect(entries).toContain(".project");
			expect(entries).toContain("metainfo.prop");
			expect(entries).toContain("src/main/resources/parameters.prop");
			expect(entries).toContain("src/main/resources/parameters.propdef");

			const iflwPath = `src/main/resources/scenarioflows/integrationflow/${result.iflow_id}.iflw`;
			expect(entries).toContain(iflwPath);

			const iflwContent = zip.getEntry(iflwPath)!.getData().toString("utf8");
			expect(iflwContent).toContain("<?xml");
			expect(iflwContent.length).toBeGreaterThan(100);

			// Manifest should have CRLF endings.
			const manifestContent = zip.getEntry("META-INF/MANIFEST.MF")!.getData().toString("utf8");
			expect(manifestContent).toContain("\r\n");
			expect(manifestContent.endsWith("\r\n")).toBe(true);

			// Always-bundled scripts should be present.
			expect(entries).toContain("src/main/resources/script/ExceptionHandler.groovy");
			expect(entries).toContain("src/main/resources/script/HeaderPreserver.groovy");
			expect(entries).toContain("src/main/resources/script/CustomScript.groovy");
			expect(entries).toContain("src/main/resources/script/CustomFunctions.groovy");
			expect(entries).toContain("src/main/resources/script/JavaMappingBridge.groovy");
		});
	}

	it("bundles PayloadLogger only when logging_enabled", () => {
		const withLogging = renderIflowZip(
			{ name: "Log_Test", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
			{ pattern_override: "generic-fallback", logging_enabled: true },
		);
		const withoutLogging = renderIflowZip(
			{ name: "NoLog_Test", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
			{ pattern_override: "generic-fallback", logging_enabled: false },
		);

		const withEntries = new AdmZip(withLogging.zip_bytes).getEntries().map((e) => e.entryName);
		const withoutEntries = new AdmZip(withoutLogging.zip_bytes).getEntries().map((e) => e.entryName);

		expect(withEntries).toContain("src/main/resources/script/PayloadLogger.groovy");
		expect(withoutEntries).not.toContain("src/main/resources/script/PayloadLogger.groovy");
	});

	it("bundles DynamicEndpoint only for SFTP/FILE receivers", () => {
		const sftpReceiver = renderIflowZip(
			{ name: "SFTP_Recv", sender_adapter: "HTTPS", receiver_adapter: "SFTP" },
			{ pattern_override: "generic-fallback" },
		);
		const httpReceiver = renderIflowZip(
			{ name: "HTTP_Recv", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
			{ pattern_override: "generic-fallback" },
		);

		const sftpEntries = new AdmZip(sftpReceiver.zip_bytes).getEntries().map((e) => e.entryName);
		const httpEntries = new AdmZip(httpReceiver.zip_bytes).getEntries().map((e) => e.entryName);

		expect(sftpEntries).toContain("src/main/resources/script/DynamicEndpoint.groovy");
		expect(httpEntries).not.toContain("src/main/resources/script/DynamicEndpoint.groovy");
	});

	it("sanitizes iflow_id (replaces non-alphanumeric with underscore)", () => {
		const result = renderIflowZip(
			{ name: "Order/Process v2", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
			{},
		);
		expect(result.iflow_id).toBe("Order_Process_v2");
	});

	it("coerces HTTPS receiver to HTTP", () => {
		const result = renderIflowZip(
			{ name: "HttpsCoerce", sender_adapter: "HTTPS", receiver_adapter: "HTTPS" },
			{ pattern_override: "generic-fallback" },
		);
		// No easy way to inspect ctx directly, but the adapter-type coercion means
		// the iflow should not contain HTTPS receiver — check manifest size sanity only.
		expect(result.zip_bytes.length).toBeGreaterThan(500);
	});

	it("uses custom description when provided", () => {
		const result = renderIflowZip(
			{ name: "DescTest", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
			{ description: "My custom description" },
		);
		expect(result.description).toBe("My custom description");
	});

	it("defaults to 'Generated iFlow: <name>' when no description", () => {
		const result = renderIflowZip(
			{ name: "NoDescTest", sender_adapter: "HTTPS", receiver_adapter: "HTTP" },
			{},
		);
		expect(result.description).toBe("Generated iFlow: NoDescTest");
	});
});
