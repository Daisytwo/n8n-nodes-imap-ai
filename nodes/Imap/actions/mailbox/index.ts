import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { ImapFlow } from 'imapflow';

/**
 * Mailbox-Actions: Discovery und Struktur-Management.
 *
 * Warum für AI Agents relevant?
 * - `list` ist typischerweise der erste Call eines Agents ("welche Ordner
 *   gibt es überhaupt?"), bevor er auf INBOX oder "Rechnungen/2026" zugreift.
 * - `status` liefert dem Agent Unseen-Counts, um "habe ich neue Mails?"
 *   zu beantworten.
 * - `testConnection` hilft beim Debugging, ohne gleich eine Mail anzufassen.
 */

export async function listMailboxes(client: ImapFlow): Promise<IDataObject[]> {
	const boxes = await client.list();
	return boxes.map((b) => ({
		path: b.path,
		name: b.name,
		delimiter: b.delimiter,
		flags: Array.from(b.flags ?? []),
		listed: b.listed,
		subscribed: b.subscribed,
		specialUse: b.specialUse,
	}));
}

export async function mailboxStatus(
	context: IExecuteFunctions,
	client: ImapFlow,
	name: string,
): Promise<IDataObject> {
	if (!name) {
		throw new NodeOperationError(context.getNode(), 'Mailbox Name is required for status');
	}
	const s = await client.status(name, {
		messages: true,
		unseen: true,
		recent: true,
		uidNext: true,
		uidValidity: true,
		highestModseq: true,
	});
	return { mailbox: name, ...(s as unknown as IDataObject) };
}

export async function mailboxQuota(
	context: IExecuteFunctions,
	client: ImapFlow,
	name: string,
): Promise<IDataObject> {
	try {
		const q = await client.getQuota(name || 'INBOX');
		if (!q) {
			return { mailbox: name, supported: false, note: 'Server does not advertise QUOTA' };
		}
		return { mailbox: name, supported: true, ...(q as unknown as IDataObject) };
	} catch (err) {
		throw new NodeOperationError(
			context.getNode(),
			`Quota query failed: ${(err as Error).message}`,
		);
	}
}

export async function createMailbox(client: ImapFlow, name: string): Promise<IDataObject> {
	const res = await client.mailboxCreate(name);
	return { created: true, ...(res as unknown as IDataObject) };
}

export async function renameMailbox(
	client: ImapFlow,
	from: string,
	to: string,
): Promise<IDataObject> {
	const res = await client.mailboxRename(from, to);
	return { renamed: true, ...(res as unknown as IDataObject) };
}

export async function deleteMailbox(client: ImapFlow, name: string): Promise<IDataObject> {
	const res = await client.mailboxDelete(name);
	return { deleted: true, ...(res as unknown as IDataObject) };
}

export async function testConnection(client: ImapFlow): Promise<IDataObject> {
	// Wenn wir hier sind, ist die Verbindung bereits offen (createImapClient
	// connect()-ed). Capability-Liste liefert guten Smoke-Test-Output.
	const caps = Array.from(client.capabilities?.keys?.() ?? []);
	return {
		success: true,
		authenticated: client.authenticated,
		capabilities: caps,
		serverInfo: (client.serverInfo as unknown as IDataObject) ?? {},
	};
}
