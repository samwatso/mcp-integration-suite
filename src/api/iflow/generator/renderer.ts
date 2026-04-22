import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import nunjucks from "nunjucks";
import type {
	InterfaceMeta,
	JobConfig,
	IFlowRenderResult,
	PatternName,
	TemplateContext,
	VersionProfile,
} from "./types";
import { buildTemplateContext } from "./context";
import { selectTemplatePattern, PATTERNS } from "./patternSelector";
import { formatManifest } from "./manifest";

const TEMPLATE_ROOT = path.join(__dirname, "templates");

interface ScriptEntry {
	file: string;
	condition: boolean;
}

function walkTemplates(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...walkTemplates(full));
		} else if (entry.isFile() && entry.name.endsWith(".j2")) {
			out.push(full);
		}
	}
	return out.sort();
}

function buildNunjucksEnv(searchPaths: string[]): nunjucks.Environment {
	const loader = new nunjucks.FileSystemLoader(searchPaths, { noCache: true });
	const env = new nunjucks.Environment(loader, {
		autoescape: true,
		trimBlocks: true,
		lstripBlocks: true,
	});
	return env;
}

export function renderIflowZip(
	iface: InterfaceMeta,
	jobConfig: JobConfig,
): IFlowRenderResult {
	const pattern: PatternName = selectTemplatePattern(iface, jobConfig);
	const resolvedPattern = PATTERNS.includes(pattern) ? pattern : "generic-fallback";

	const patternDir = path.join(TEMPLATE_ROOT, resolvedPattern);
	const effectivePatternDir = fs.existsSync(patternDir)
		? patternDir
		: path.join(TEMPLATE_ROOT, "generic-fallback");
	const effectivePattern: PatternName = fs.existsSync(patternDir)
		? resolvedPattern
		: "generic-fallback";

	const versionProfile: VersionProfile = jobConfig.cpi_version_profile ?? "latest";
	const ctx: TemplateContext = buildTemplateContext(
		iface,
		jobConfig,
		versionProfile,
		jobConfig.adapter_version_overrides,
	);

	const sharedDir = path.join(TEMPLATE_ROOT, "_shared");
	const searchPaths = [effectivePatternDir];
	if (fs.existsSync(sharedDir)) searchPaths.push(sharedDir);

	const env = buildNunjucksEnv(searchPaths);

	const zip = new AdmZip();

	for (const templatePath of walkTemplates(effectivePatternDir)) {
		const relPath = path.relative(effectivePatternDir, templatePath);
		const templateName = relPath.split(path.sep).join("/");

		let outputName = templateName.slice(0, -".j2".length);
		outputName = outputName.replace("{Name}", ctx.iflow_name);
		outputName = outputName.replace("iflow.iflw", `${ctx.iflow_id}.iflw`);

		let rendered = env.render(templateName, ctx as unknown as object);
		if (outputName === "META-INF/MANIFEST.MF") {
			rendered = formatManifest(rendered);
		}

		zip.addFile(outputName, Buffer.from(rendered, "utf8"));
	}

	// Shared script library — always bundled subset plus conditional additions.
	const scriptLibrary: ScriptEntry[] = [
		{ file: "ExceptionHandler.groovy.j2", condition: true },
		{ file: "HeaderPreserver.groovy.j2", condition: true },
		{ file: "CustomScript.groovy.j2", condition: true },
		{ file: "CustomFunctions.groovy.j2", condition: true },
		{ file: "JavaMappingBridge.groovy.j2", condition: true },
		{ file: "PayloadLogger.groovy.j2", condition: ctx.logging_enabled },
		{ file: "PayloadSizeGuard.groovy.j2", condition: ctx.entry_scripts_enabled },
		{ file: "ReplaySnapshot.groovy.j2", condition: ctx.entry_scripts_enabled },
		{ file: "DynamicEndpoint.groovy.j2", condition: ctx.needs_dynamic_endpoint },
	];
	const legacyScripts: ScriptEntry[] = [
		{ file: "ErrorPayloadBuilder.groovy.j2", condition: ctx.error_handling_enabled },
		{ file: "PayloadLogBefore.groovy.j2", condition: ctx.logging_enabled },
		{ file: "PayloadLogAfter.groovy.j2", condition: ctx.logging_enabled },
		{ file: "ExceptionBodyLoggingScript.groovy.j2", condition: ctx.error_handling_enabled },
	];

	const bundleScript = ({ file, condition }: ScriptEntry) => {
		if (!condition) return;
		const scriptPath = path.join(sharedDir, file);
		if (!fs.existsSync(scriptPath)) return;
		const renderedScript = env.render(file, ctx as unknown as object);
		const outputName = file.replace(".j2", "");
		zip.addFile(
			`src/main/resources/script/${outputName}`,
			Buffer.from(renderedScript, "utf8"),
		);
	};

	if (fs.existsSync(sharedDir)) {
		scriptLibrary.forEach(bundleScript);
		legacyScripts.forEach(bundleScript);
	}

	return {
		zip_bytes: zip.toBuffer(),
		pattern: effectivePattern,
		iflow_id: ctx.iflow_id,
		iflow_name: ctx.iflow_name,
		description: ctx.description,
		sender_system: ctx.sender_system,
		receiver_system: ctx.receiver_system,
	};
}
