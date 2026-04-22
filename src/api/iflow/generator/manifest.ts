// SAP CPI's Java import parser enforces JAR/OSGi manifest rules strictly:
// - Each line max 72 bytes (not characters) — continuation lines start with a single space
// - CRLF endings throughout
// - File must end with CRLF
export function formatManifest(content: string): string {
	const normalized = content
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.replace(/\n+$/, "")
		.split("\n");

	const out: string[] = [];
	for (const line of normalized) {
		if (byteLen(line) <= 72) {
			out.push(line);
			continue;
		}
		// First chunk: up to 72 bytes; continuation chunks: up to 71 bytes (1 byte for leading space)
		let [head, rest] = sliceBytes(line, 72);
		out.push(head);
		while (rest.length > 0) {
			const [chunk, remaining] = sliceBytes(rest, 71);
			out.push(" " + chunk);
			rest = remaining;
		}
	}
	return out.join("\r\n") + "\r\n";
}

function byteLen(s: string): number {
	return Buffer.byteLength(s, "utf8");
}

function sliceBytes(s: string, maxBytes: number): [string, string] {
	if (byteLen(s) <= maxBytes) return [s, ""];
	const buf = Buffer.from(s, "utf8");
	// Don't split in the middle of a UTF-8 multibyte sequence.
	let cut = maxBytes;
	while (cut > 0 && (buf[cut] & 0xc0) === 0x80) cut--;
	const head = buf.subarray(0, cut).toString("utf8");
	const tail = buf.subarray(cut).toString("utf8");
	return [head, tail];
}
