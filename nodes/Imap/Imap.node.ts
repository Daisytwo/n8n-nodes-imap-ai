import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	resourceDescription,
	emailOperations,
	mailboxOperations,
	downloadOperations,
	mailboxField,
	uidField,
	targetFolderField,
	flagField,
	searchFilters,
	searchOptions,
	getOptions,
	mailboxNameField,
	mailboxNewNameField,
	appendSourceField,
	appendRawField,
	appendBinaryField,
	downloadAttachmentFilter,
} from './descriptions';

import { createImapClient, safeLogout } from './helpers/connection';

import * as mailboxActions from './actions/mailbox';
import * as emailActions from './actions/email';
import * as downloadActions from './actions/download';

/**
 * Imap Node — mit AI Agent Tool-Support (`usableAsTool: true`).
 *
 * Design-Entscheidungen:
 * 1. **Router-Pattern**: Ein einziger `execute()` öffnet EINE Verbindung pro
 *    Execute-Lauf und iteriert über alle Input-Items. So reduzieren wir bei
 *    Bulk-Runs (z. B. 200 UIDs → 200 Move-Operationen) die Connection-Overhead
 *    von 200× TCP+TLS+Auth auf 1×.
 * 2. **continueOnFail**: Pro Item gefangen — Agent-Workflows scheitern sonst
 *    an einer einzelnen Mail.
 * 3. **usableAsTool**: Resource+Operation+Parameter sind alle mit AI-lesbaren
 *    Descriptions versehen, sodass das LLM im AI-Agent-Node die passende
 *    Operation auswählen kann.
 */
export class Imap implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'IMAP (AI)',
		name: 'imap',
		icon: 'file:imap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Read, search, move, flag and download emails from any IMAP server. Fully usable as a tool from AI Agent nodes.',
		defaults: {
			name: 'IMAP (AI)',
		},
		// NodeConnectionType.Main ist der Standard-Datenfluss. Für AI-Tool-
		// Verwendung reicht Main; der AI Agent Node hängt sich automatisch an,
		// wenn `usableAsTool: true` gesetzt ist.
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'imapApi',
				required: true,
			},
		],
		properties: [
			resourceDescription,
			mailboxOperations,
			emailOperations,
			downloadOperations,
			mailboxField,
			mailboxNameField,
			mailboxNewNameField,
			uidField,
			targetFolderField,
			flagField,
			searchFilters,
			searchOptions,
			getOptions,
			appendSourceField,
			appendRawField,
			appendBinaryField,
			downloadAttachmentFilter,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const client = await createImapClient(this);

		try {
			for (let i = 0; i < items.length; i++) {
				try {
					const resource = this.getNodeParameter('resource', i) as string;
					const operation = this.getNodeParameter('operation', i) as string;

					if (resource === 'mailbox') {
						if (operation === 'list') {
							const boxes = await mailboxActions.listMailboxes(client);
							for (const b of boxes) returnData.push({ json: b });
						} else if (operation === 'status') {
							const name = this.getNodeParameter('mailboxName', i) as string;
							returnData.push({
								json: await mailboxActions.mailboxStatus(this, client, name),
							});
						} else if (operation === 'quota') {
							const name = this.getNodeParameter('mailboxName', i) as string;
							returnData.push({
								json: await mailboxActions.mailboxQuota(this, client, name),
							});
						} else if (operation === 'create') {
							const name = this.getNodeParameter('mailboxName', i) as string;
							returnData.push({ json: await mailboxActions.createMailbox(client, name) });
						} else if (operation === 'rename') {
							const from = this.getNodeParameter('mailboxName', i) as string;
							const to = this.getNodeParameter('newName', i) as string;
							returnData.push({ json: await mailboxActions.renameMailbox(client, from, to) });
						} else if (operation === 'delete') {
							const name = this.getNodeParameter('mailboxName', i) as string;
							returnData.push({ json: await mailboxActions.deleteMailbox(client, name) });
						} else if (operation === 'testConnection') {
							returnData.push({ json: await mailboxActions.testConnection(client) });
						} else {
							throw new NodeOperationError(
								this.getNode(),
								`Unknown mailbox operation "${operation}"`,
								{ itemIndex: i },
							);
						}
					} else if (resource === 'email') {
						const mailbox = this.getNodeParameter('mailbox', i, 'INBOX') as string;

						if (operation === 'search') {
							const results = await emailActions.searchEmails(this, client, mailbox, i);
							returnData.push(...results);
						} else if (operation === 'get') {
							returnData.push(await emailActions.getEmail(this, client, mailbox, i));
						} else if (operation === 'move') {
							returnData.push({
								json: await emailActions.moveEmail(this, client, mailbox, i),
							});
						} else if (operation === 'copy') {
							returnData.push({
								json: await emailActions.copyEmail(this, client, mailbox, i),
							});
						} else if (operation === 'delete') {
							returnData.push({
								json: await emailActions.deleteEmail(this, client, mailbox, i),
							});
						} else if (operation === 'markRead') {
							returnData.push({ json: await emailActions.markRead(this, client, mailbox, i) });
						} else if (operation === 'markUnread') {
							returnData.push({
								json: await emailActions.markUnread(this, client, mailbox, i),
							});
						} else if (operation === 'flag') {
							returnData.push({ json: await emailActions.setFlag(this, client, mailbox, i) });
						} else if (operation === 'unflag') {
							returnData.push({
								json: await emailActions.removeFlag(this, client, mailbox, i),
							});
						} else if (operation === 'append') {
							returnData.push({
								json: await emailActions.appendEmail(this, client, mailbox, i),
							});
						} else {
							throw new NodeOperationError(
								this.getNode(),
								`Unknown email operation "${operation}"`,
								{ itemIndex: i },
							);
						}
					} else if (resource === 'download') {
						const mailbox = this.getNodeParameter('mailbox', i, 'INBOX') as string;
						if (operation === 'downloadAttachments') {
							returnData.push(
								await downloadActions.downloadAttachments(this, client, mailbox, i),
							);
						} else if (operation === 'downloadEml') {
							returnData.push(await downloadActions.downloadEml(this, client, mailbox, i));
						} else {
							throw new NodeOperationError(
								this.getNode(),
								`Unknown download operation "${operation}"`,
								{ itemIndex: i },
							);
						}
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
							itemIndex: i,
						});
					}
				} catch (err) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: (err as Error).message },
							pairedItem: { item: i },
						});
						continue;
					}
					throw err;
				}
			}
		} finally {
			await safeLogout(client);
		}

		return [returnData];
	}
}
