import type {
	IExecuteFunctions,
	IDataObject,
	IBinaryKeyData,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { ImapFlow } from 'imapflow';
import { buildSearchQuery, type SearchInputRaw } from '../../helpers/search';
import { parseRawEmail } from '../../helpers/parser';

/**
 * Email-Actions.
 *
 * Warum für AI Agents relevant?
 * - `search` ist das wichtigste Tool: Agent beschreibt in Natural-Language
 *   "finde alle ungelesenen Mails von alice@… seit letzter Woche", das LLM
 *   mapt auf unser Filter-JSON, imapflow macht daraus ein echtes IMAP SEARCH.
 * - `get` liefert strukturierten Body, mit dem LLMs Folgeentscheidungen
 *   treffen (Antworten? Weiterleiten? Archivieren?).
 * - `move` / `flag` / `markRead` sind die klassischen Agent-Aktionen nach
 *   einer Klassifikation ("Rechnung → /Archive/2026/Rechnungen").
 */

async function ensureMailbox(client: ImapFlow, mailbox: string): Promise<void> {
	if (client.mailbox && (client.mailbox as { path: string }).path === mailbox) return;
	await client.mailboxOpen(mailbox);
}

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

export async function searchEmails(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	await ensureMailbox(client, mailbox);

	const filters = context.getNodeParameter(
		'searchFilters',
		itemIndex,
		{},
	) as SearchInputRaw;
	const options = context.getNodeParameter('options', itemIndex, {}) as {
		limit?: number;
		includeBody?: boolean;
		includeHeaders?: boolean;
		newestFirst?: boolean;
	};
	const limit = options.limit ?? 50;
	const includeBody = options.includeBody ?? false;
	const includeHeaders = options.includeHeaders ?? false;
	const newestFirst = options.newestFirst ?? true;

	const query = buildSearchQuery(filters);
	const uids = (await client.search(query, { uid: true })) || [];

	// newest-first = höchste UID zuerst (korreliert i. d. R. mit Datum)
	const sorted = newestFirst ? [...uids].sort((a, b) => b - a) : uids;
	const sliced = sorted.slice(0, limit);

	const out: INodeExecutionData[] = [];

	if (sliced.length === 0) {
		return out;
	}

	for await (const msg of client.fetch(
		sliced.map(String).join(','),
		{
			uid: true,
			envelope: true,
			flags: true,
			size: true,
			internalDate: true,
			// Body nur wenn gewünscht — IMAP round-trip ist teuer
			source: includeBody,
			bodyStructure: !includeBody,
		},
		{ uid: true },
	)) {
		if (includeBody && msg.source) {
			const { json, binary } = await parseRawEmail(context, msg.source, Number(msg.uid), {
				includeAttachments: false,
				includeHeaders,
				flags: Array.from(msg.flags ?? []),
			});
			out.push({ json: json as unknown as IDataObject, binary });
		} else {
			// Nur Envelope ohne Body-Parsing
			const env = msg.envelope;
			const item: IDataObject = {
				uid: Number(msg.uid),
				messageId: env?.messageId,
				subject: env?.subject,
				from: env?.from?.map((a) => ({ address: a.address, name: a.name })),
				to: env?.to?.map((a) => ({ address: a.address, name: a.name })),
				cc: env?.cc?.map((a) => ({ address: a.address, name: a.name })),
				date: env?.date ? new Date(env.date).toISOString() : undefined,
				size: msg.size,
				flags: Array.from(msg.flags ?? []),
				internalDate: msg.internalDate ? new Date(msg.internalDate).toISOString() : undefined,
			};
			out.push({ json: item });
		}
	}

	return out;
}

/* ------------------------------------------------------------------ */
/* Get                                                                */
/* ------------------------------------------------------------------ */

export async function getEmail(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<INodeExecutionData> {
	await ensureMailbox(client, mailbox);

	const uid = context.getNodeParameter('uid', itemIndex) as number;
	const options = context.getNodeParameter('options', itemIndex, {}) as {
		includeAttachments?: boolean;
		includeHeaders?: boolean;
		markAsRead?: boolean;
	};

	if (!uid || uid <= 0) {
		throw new NodeOperationError(context.getNode(), 'UID must be a positive integer', {
			itemIndex,
		});
	}

	const fetched = await client.fetchOne(
		String(uid),
		{ uid: true, flags: true, source: true },
		{ uid: true },
	);

	if (!fetched || !fetched.source) {
		throw new NodeOperationError(context.getNode(), `No message with UID ${uid} in "${mailbox}"`, {
			itemIndex,
		});
	}

	const parsed = await parseRawEmail(context, fetched.source, Number(fetched.uid), {
		includeAttachments: options.includeAttachments ?? false,
		includeHeaders: options.includeHeaders ?? false,
		flags: Array.from(fetched.flags ?? []),
	});

	if (options.markAsRead) {
		await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
	}

	const out: INodeExecutionData = { json: parsed.json as unknown as IDataObject };
	if (parsed.binary) out.binary = parsed.binary as IBinaryKeyData;
	return out;
}

/* ------------------------------------------------------------------ */
/* Move / Copy / Delete                                               */
/* ------------------------------------------------------------------ */

export async function moveEmail(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	const target = context.getNodeParameter('targetFolder', itemIndex) as string;

	const res = await client.messageMove(String(uid), target, { uid: true });
	return { moved: true, uid, target, result: res as unknown as IDataObject };
}

export async function copyEmail(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	const target = context.getNodeParameter('targetFolder', itemIndex) as string;

	const res = await client.messageCopy(String(uid), target, { uid: true });
	return { copied: true, uid, target, result: res as unknown as IDataObject };
}

export async function deleteEmail(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;

	await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true });
	// Manche Server (Gmail) brauchen expunge; andere räumen automatisch.
	try {
		await client.messageDelete(String(uid), { uid: true });
	} catch {
		// Fallback: nur Flag setzen, Server wird bei nächstem expunge löschen
	}
	return { deleted: true, uid };
}

/* ------------------------------------------------------------------ */
/* Flags                                                              */
/* ------------------------------------------------------------------ */

export async function markRead(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
	return { uid, flag: '\\Seen', added: true };
}

export async function markUnread(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true });
	return { uid, flag: '\\Seen', removed: true };
}

export async function setFlag(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	const flag = context.getNodeParameter('flag', itemIndex) as string;
	await client.messageFlagsAdd(String(uid), [flag], { uid: true });
	return { uid, flag, added: true };
}

export async function removeFlag(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	const flag = context.getNodeParameter('flag', itemIndex) as string;
	await client.messageFlagsRemove(String(uid), [flag], { uid: true });
	return { uid, flag, removed: true };
}

/* ------------------------------------------------------------------ */
/* Append                                                             */
/* ------------------------------------------------------------------ */

export async function appendEmail(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<IDataObject> {
	const source = context.getNodeParameter('appendSource', itemIndex, 'text') as
		| 'text'
		| 'binary';

	let raw: Buffer;
	if (source === 'text') {
		const txt = context.getNodeParameter('rawMessage', itemIndex) as string;
		if (!txt) {
			throw new NodeOperationError(context.getNode(), 'Raw RFC822 message is empty', {
				itemIndex,
			});
		}
		raw = Buffer.from(txt, 'utf8');
	} else {
		const binProp = context.getNodeParameter('binaryProperty', itemIndex, 'data') as string;
		const bin = context.helpers.assertBinaryData(itemIndex, binProp);
		raw = await context.helpers.getBinaryDataBuffer(itemIndex, binProp);
		if (!bin) {
			throw new NodeOperationError(
				context.getNode(),
				`No binary property "${binProp}" on input item`,
			);
		}
	}

	const res = await client.append(mailbox, raw);
	return { appended: true, mailbox, result: res as unknown as IDataObject };
}
