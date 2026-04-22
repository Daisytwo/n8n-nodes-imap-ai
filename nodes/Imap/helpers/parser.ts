import { simpleParser, type ParsedMail, type Attachment as MailAttachment } from 'mailparser';
import type { IBinaryData, IBinaryKeyData, IExecuteFunctions } from 'n8n-workflow';

/**
 * Ergebnis-Shape einer geparsten Email — optimiert darauf, dass ein
 * LLM damit arbeiten kann: flache, sprechende Feldnamen, ISO-Dates,
 * getrennte Blöcke für Meta / Text / HTML / Attachments.
 */
export interface ParsedEmailJson {
	uid: number;
	messageId?: string;
	subject?: string;
	from?: { address: string; name?: string }[];
	to?: { address: string; name?: string }[];
	cc?: { address: string; name?: string }[];
	bcc?: { address: string; name?: string }[];
	replyTo?: { address: string; name?: string }[];
	date?: string;
	textPlain?: string;
	textHtml?: string;
	headers?: Record<string, string>;
	attachments?: Array<{
		filename: string | undefined;
		contentType: string;
		size: number;
		/** Index in der Binary-Data — Key lautet `attachment_<index>` */
		binaryKey?: string;
	}>;
	flags?: string[];
}

/**
 * Convert `AddressObject | AddressObject[]` aus mailparser in flaches Array.
 */
function flattenAddresses(
	input: ParsedMail['from'] | ParsedMail['to'],
): { address: string; name?: string }[] | undefined {
	if (!input) return undefined;
	const arr = Array.isArray(input) ? input : [input];
	const out: { address: string; name?: string }[] = [];
	for (const obj of arr) {
		if (!obj) continue;
		for (const a of obj.value) {
			if (a.address) {
				out.push({ address: a.address, name: a.name || undefined });
			}
		}
	}
	return out.length ? out : undefined;
}

/**
 * Filter-Kriterien für Attachments. Name kann Substring oder RegEx sein.
 */
export interface AttachmentFilter {
	filename?: string; // Substring match, case-insensitive
	mimeType?: string; // z. B. "application/pdf" oder "image/*"
}

function matchesMime(actual: string, pattern: string): boolean {
	if (!pattern) return true;
	if (pattern === actual) return true;
	if (pattern.endsWith('/*')) {
		const prefix = pattern.slice(0, -1);
		return actual.startsWith(prefix);
	}
	return false;
}

function matchesAttachment(a: MailAttachment, f?: AttachmentFilter): boolean {
	if (!f) return true;
	if (f.filename) {
		const name = a.filename || '';
		if (!name.toLowerCase().includes(f.filename.toLowerCase())) return false;
	}
	if (f.mimeType) {
		if (!matchesMime(a.contentType || '', f.mimeType)) return false;
	}
	return true;
}

/**
 * Parst einen Raw-Email-Buffer (RFC822) und packt das Ergebnis plus
 * optional die Attachments in n8n-Binary-Data.
 */
export async function parseRawEmail(
	context: IExecuteFunctions,
	raw: Buffer,
	uid: number,
	options: {
		includeAttachments?: boolean;
		attachmentFilter?: AttachmentFilter;
		includeHeaders?: boolean;
		flags?: string[];
	} = {},
): Promise<{ json: ParsedEmailJson; binary?: IBinaryKeyData }> {
	const parsed = await simpleParser(raw);

	const json: ParsedEmailJson = {
		uid,
		messageId: parsed.messageId,
		subject: parsed.subject,
		from: flattenAddresses(parsed.from),
		to: flattenAddresses(parsed.to),
		cc: flattenAddresses(parsed.cc),
		bcc: flattenAddresses(parsed.bcc),
		replyTo: flattenAddresses(parsed.replyTo),
		date: parsed.date ? parsed.date.toISOString() : undefined,
		textPlain: parsed.text,
		textHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
		flags: options.flags,
	};

	if (options.includeHeaders) {
		const headers: Record<string, string> = {};
		for (const [k, v] of parsed.headers) {
			headers[k] = typeof v === 'string' ? v : JSON.stringify(v);
		}
		json.headers = headers;
	}

	let binary: IBinaryKeyData | undefined;

	if (options.includeAttachments && parsed.attachments?.length) {
		binary = {};
		json.attachments = [];
		let idx = 0;
		for (const att of parsed.attachments) {
			if (!matchesAttachment(att, options.attachmentFilter)) continue;
			const key = `attachment_${idx}`;
			const bin: IBinaryData = await context.helpers.prepareBinaryData(
				att.content,
				att.filename || `attachment_${idx}`,
				att.contentType || 'application/octet-stream',
			);
			binary[key] = bin;
			json.attachments.push({
				filename: att.filename,
				contentType: att.contentType || 'application/octet-stream',
				size: att.size,
				binaryKey: key,
			});
			idx++;
		}
		if (idx === 0) {
			// Kein Attachment passte auf Filter — Binary-Block komplett weglassen
			binary = undefined;
		}
	} else if (parsed.attachments?.length) {
		// Meta nur, kein Binary
		json.attachments = parsed.attachments.map((a) => ({
			filename: a.filename,
			contentType: a.contentType || 'application/octet-stream',
			size: a.size,
		}));
	}

	return { json, binary };
}
