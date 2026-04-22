import type {
	IExecuteFunctions,
	INodeExecutionData,
	IBinaryKeyData,
	IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { ImapFlow } from 'imapflow';
import { parseRawEmail, type AttachmentFilter } from '../../helpers/parser';

/**
 * Download-Actions.
 *
 * Warum für AI Agents relevant?
 * - Viele Agent-Workflows enden mit "PDF-Rechnung an Paperless weiterleiten".
 *   `downloadAttachments` mit MIME-Filter `application/pdf` ist dafür die
 *   idiomatische Lösung — der Agent muss keine MIME-Parsing-Logik selber
 *   bauen, sondern reicht das Binary durch an den nächsten Node.
 * - `downloadEml` ist der Fallback für Archive und Forensik.
 */

async function ensureMailbox(client: ImapFlow, mailbox: string): Promise<void> {
	if (client.mailbox && (client.mailbox as { path: string }).path === mailbox) return;
	await client.mailboxOpen(mailbox);
}

export async function downloadAttachments(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<INodeExecutionData> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;
	const filter = context.getNodeParameter(
		'attachmentFilter',
		itemIndex,
		{},
	) as AttachmentFilter;

	const fetched = await client.fetchOne(
		String(uid),
		{ uid: true, source: true, flags: true },
		{ uid: true },
	);
	if (!fetched || !fetched.source) {
		throw new NodeOperationError(context.getNode(), `No message with UID ${uid} in "${mailbox}"`, {
			itemIndex,
		});
	}

	const { json, binary } = await parseRawEmail(context, fetched.source, Number(fetched.uid), {
		includeAttachments: true,
		attachmentFilter: filter,
		flags: Array.from(fetched.flags ?? []),
	});

	const out: INodeExecutionData = {
		json: {
			uid: json.uid,
			subject: json.subject,
			from: json.from,
			attachmentCount: json.attachments?.length ?? 0,
			attachments: json.attachments,
		} as IDataObject,
	};
	if (binary) out.binary = binary as IBinaryKeyData;
	return out;
}

export async function downloadEml(
	context: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<INodeExecutionData> {
	await ensureMailbox(client, mailbox);
	const uid = context.getNodeParameter('uid', itemIndex) as number;

	const fetched = await client.fetchOne(
		String(uid),
		{ uid: true, source: true, envelope: true },
		{ uid: true },
	);
	if (!fetched || !fetched.source) {
		throw new NodeOperationError(context.getNode(), `No message with UID ${uid} in "${mailbox}"`, {
			itemIndex,
		});
	}

	const subject = fetched.envelope?.subject ?? `message-${uid}`;
	const safe = subject.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
	const filename = `${safe || 'message'}.eml`;

	const bin = await context.helpers.prepareBinaryData(fetched.source, filename, 'message/rfc822');
	return {
		json: {
			uid: Number(fetched.uid),
			subject,
			filename,
			size: fetched.source.length,
		},
		binary: { data: bin },
	};
}
