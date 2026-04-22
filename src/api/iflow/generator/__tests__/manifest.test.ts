import { formatManifest } from "../manifest";

describe("formatManifest", () => {
	it("passes a short line through unchanged (with trailing CRLF)", () => {
		const out = formatManifest("Manifest-Version: 1.0");
		expect(out).toBe("Manifest-Version: 1.0\r\n");
	});

	it("uses CRLF throughout for multiple lines", () => {
		const out = formatManifest("A: 1\nB: 2\nC: 3");
		expect(out).toBe("A: 1\r\nB: 2\r\nC: 3\r\n");
	});

	it("folds a line longer than 72 bytes with leading-space continuation", () => {
		const longValue = "x".repeat(100);
		const line = `Long-Header: ${longValue}`; // 113 bytes
		const out = formatManifest(line);
		const parts = out.split("\r\n");
		// Expect: first chunk (72 bytes), continuation (1 space + up to 71 bytes), possibly more continuations
		expect(parts[0].length).toBe(72);
		expect(parts[1].startsWith(" ")).toBe(true);
		// All non-empty lines reconstruct the original content.
		const rejoined = parts
			.filter((p, i) => p.length > 0 || i !== parts.length - 1)
			.map((p, i) => (i === 0 ? p : p.slice(1)))
			.join("");
		expect(rejoined).toBe(line);
	});

	it("normalizes CRLF input and strips trailing newlines before re-adding CRLF", () => {
		const out = formatManifest("A: 1\r\nB: 2\r\n\r\n");
		expect(out).toBe("A: 1\r\nB: 2\r\n");
	});

	it("empty input yields a single CRLF", () => {
		expect(formatManifest("")).toBe("\r\n");
	});

	it("does not split inside a UTF-8 multibyte sequence when folding", () => {
		// 70 ASCII bytes + one 3-byte UTF-8 char (é is 2 bytes, 世 is 3) = 73 bytes total,
		// so folding would cut mid-character if naive. Verify the multibyte char stays intact.
		const line = "X".repeat(70) + "世界";
		const out = formatManifest(line);
		const parts = out.split("\r\n");
		// The multibyte char (3 bytes) cannot fit in the remaining 2 bytes of the 72-byte head,
		// so it must be pushed to the continuation line.
		expect(parts[0].length).toBeLessThanOrEqual(72);
		// Reconstructing must yield exactly the original line.
		const rejoined = parts
			.filter((p, i) => p.length > 0 || i !== parts.length - 1)
			.map((p, i) => (i === 0 ? p : p.slice(1)))
			.join("");
		expect(rejoined).toBe(line);
	});
});
