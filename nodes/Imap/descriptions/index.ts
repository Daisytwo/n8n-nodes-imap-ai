import type { INodeProperties } from 'n8n-workflow';

/**
 * Top-Level-Resource Dropdown.
 *
 * Bewusst drei Resources: `mailbox` (Folder/Quota-Management),
 * `email` (Lesen/Schreiben/Flag) und `download` (Binär-Output).
 * Das schafft für LLMs eine klare Funktions-Hierarchie und macht die
 * operation-Dropdowns pro Resource überschaubar (≤ 10 Einträge).
 */
export const resourceDescription: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Email',
			value: 'email',
			description: 'Read, search, move, flag or append messages',
		},
		{
			name: 'Mailbox',
			value: 'mailbox',
			description: 'Manage IMAP folders (list, create, rename, delete, quota)',
		},
		{
			name: 'Download',
			value: 'download',
			description: 'Export attachments or whole messages as binary data',
		},
	],
	default: 'email',
};

/* ------------------------------------------------------------------ */
/* EMAIL operations                                                   */
/* ------------------------------------------------------------------ */

export const emailOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['email'] } },
	options: [
		{
			name: 'Append',
			value: 'append',
			action: 'Append a raw email to a folder',
			description: 'Upload a raw RFC822 message (e.g. a draft) to a folder',
		},
		{
			name: 'Copy',
			value: 'copy',
			action: 'Copy an email to another folder',
			description: 'Copy a message (by UID) into another folder, keeping the original',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete an email',
			description:
				'Mark an email for deletion (\\Deleted flag) and EXPUNGE. Irreversible on most servers.',
		},
		{
			name: 'Flag',
			value: 'flag',
			action: 'Flag an email',
			description: 'Add \\Flagged (star) or a custom keyword to an email',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get an email by UID',
			description:
				'Fetch one specific email by its UID in a folder. Returns parsed subject/body/headers and optionally attachments.',
		},
		{
			name: 'Mark Read',
			value: 'markRead',
			action: 'Mark an email as read',
			description: 'Add the \\Seen flag to an email',
		},
		{
			name: 'Mark Unread',
			value: 'markUnread',
			action: 'Mark an email as unread',
			description: 'Remove the \\Seen flag from an email',
		},
		{
			name: 'Move',
			value: 'move',
			action: 'Move an email to another folder',
			description: 'Move a message (by UID) from the current folder into a target folder',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search for emails',
			description:
				'Search emails using IMAP criteria (FROM, SUBJECT, SINCE, UNSEEN, FLAGGED, TEXT, BODY). Use this when the AI needs to find messages matching a description.',
		},
		{
			name: 'Unflag',
			value: 'unflag',
			action: 'Unflag an email',
			description: 'Remove \\Flagged or a custom keyword from an email',
		},
	],
	default: 'search',
};

/* ------------------------------------------------------------------ */
/* MAILBOX operations                                                 */
/* ------------------------------------------------------------------ */

export const mailboxOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['mailbox'] } },
	options: [
		{
			name: 'Create',
			value: 'create',
			action: 'Create a mailbox',
			description: 'Create a new folder (use hierarchy separator, usually "/" or ".")',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a mailbox',
			description: 'Delete a folder. Most servers refuse to delete INBOX.',
		},
		{
			name: 'List',
			value: 'list',
			action: 'List mailboxes',
			description:
				'List all folders/mailboxes (INBOX, Sent, Trash, plus custom labels). Use before any folder-specific operation to discover available paths.',
		},
		{
			name: 'Quota',
			value: 'quota',
			action: 'Get mailbox quota',
			description: 'Return storage quota (used / total) if the server supports RFC 2087',
		},
		{
			name: 'Rename',
			value: 'rename',
			action: 'Rename a mailbox',
			description: 'Rename an existing folder',
		},
		{
			name: 'Status',
			value: 'status',
			action: 'Get mailbox status',
			description: 'Get message count, unseen count and UIDVALIDITY for a mailbox',
		},
		{
			name: 'Test Connection',
			value: 'testConnection',
			action: 'Test the IMAP connection',
			description: 'Connect, log in, log out. Returns server capability list.',
		},
	],
	default: 'list',
};

/* ------------------------------------------------------------------ */
/* DOWNLOAD operations                                                */
/* ------------------------------------------------------------------ */

export const downloadOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['download'] } },
	options: [
		{
			name: 'Download Attachments',
			value: 'downloadAttachments',
			action: 'Download attachments from an email',
			description:
				'Fetch all attachments of one email as binary data, optionally filtered by filename substring or MIME type',
		},
		{
			name: 'Download EML',
			value: 'downloadEml',
			action: 'Download full email as eml',
			description: 'Download the complete raw RFC822 message as a single .eml binary',
		},
	],
	default: 'downloadAttachments',
};

/* ------------------------------------------------------------------ */
/* Shared input fields                                                */
/* ------------------------------------------------------------------ */

export const mailboxField: INodeProperties = {
	displayName: 'Mailbox / Folder',
	name: 'mailbox',
	type: 'string',
	default: 'INBOX',
	placeholder: 'INBOX',
	description: 'IMAP folder path. Examples: INBOX, Sent, Archive/2026, [Gmail]/All Mail.',
	displayOptions: {
		show: {
			resource: ['email', 'download'],
		},
	},
	required: true,
};

export const uidField: INodeProperties = {
	displayName: 'UID',
	name: 'uid',
	type: 'number',
	default: 0,
	description: 'The unique message identifier (UID) inside the folder. Find via Email → Search.',
	displayOptions: {
		show: {
			resource: ['email', 'download'],
			operation: [
				'get',
				'move',
				'copy',
				'delete',
				'markRead',
				'markUnread',
				'flag',
				'unflag',
				'downloadAttachments',
				'downloadEml',
			],
		},
	},
	required: true,
};

export const targetFolderField: INodeProperties = {
	displayName: 'Target Folder',
	name: 'targetFolder',
	type: 'string',
	default: '',
	description: 'Destination folder path for move/copy',
	displayOptions: {
		show: {
			resource: ['email'],
			operation: ['move', 'copy'],
		},
	},
	required: true,
};

export const flagField: INodeProperties = {
	displayName: 'Flag',
	name: 'flag',
	type: 'string',
	default: '\\Flagged',
	description:
		'Flag to set/remove. Use "\\\\Flagged" for the star, "\\\\Seen" for read-state, or a custom keyword (e.g. "Important").',
	displayOptions: {
		show: {
			resource: ['email'],
			operation: ['flag', 'unflag'],
		},
	},
	required: true,
};

/* ------------------------------------------------------------------ */
/* Search input (AI-friendly flat JSON)                               */
/* ------------------------------------------------------------------ */

export const searchFilters: INodeProperties = {
	displayName: 'Search Filters',
	name: 'searchFilters',
	type: 'collection',
	placeholder: 'Add Filter',
	default: {},
	description: 'IMAP search criteria. All fields are AND-combined. Leave empty to match all.',
	displayOptions: {
		show: {
			resource: ['email'],
			operation: ['search'],
		},
	},
	options: [
		{
			displayName: 'Before (ISO Date)',
			name: 'before',
			type: 'string',
			default: '',
			placeholder: '2026-04-22',
			description: 'Only mails before this date',
		},
		{
			displayName: 'Body',
			name: 'body',
			type: 'string',
			default: '',
			description: 'Full-text search inside the body',
		},
		{
			displayName: 'From',
			name: 'from',
			type: 'string',
			default: '',
			description: 'Substring of the From header (e.g. "alice@example.com" or "Alice")',
		},
		{
			displayName: 'Has Attachment (approx.)',
			name: 'hasAttachment',
			type: 'boolean',
			default: false,
			description:
				'Whether to return only messages likely to contain attachments (heuristic: size > 50 KB)',
		},
		{
			displayName: 'Larger Than (Bytes)',
			name: 'larger',
			type: 'number',
			default: 0,
			description: 'Minimum message size in bytes',
		},
		{
			displayName: 'Only Answered',
			name: 'answered',
			type: 'boolean',
			default: false,
			description: 'Whether to return only messages with the \\Answered flag',
		},
		{
			displayName: 'Only Flagged',
			name: 'flagged',
			type: 'boolean',
			default: false,
			description: 'Whether to return only \\Flagged (starred) messages',
		},
		{
			displayName: 'Only Seen',
			name: 'seen',
			type: 'boolean',
			default: false,
			description: 'Whether to return only read messages',
		},
		{
			displayName: 'Only Unseen',
			name: 'unseen',
			type: 'boolean',
			default: false,
			description: 'Whether to return only unread messages',
		},
		{
			displayName: 'Since (ISO Date)',
			name: 'since',
			type: 'string',
			default: '',
			placeholder: '2026-04-01',
			description: 'Only mails on/after this date. Accepts ISO 8601 (e.g. 2026-04-01).',
		},
		{
			displayName: 'Smaller Than (Bytes)',
			name: 'smaller',
			type: 'number',
			default: 0,
			description: 'Maximum message size in bytes',
		},
		{
			displayName: 'Subject',
			name: 'subject',
			type: 'string',
			default: '',
			description: 'Substring in the Subject header (e.g. "Invoice")',
		},
		{
			displayName: 'Text (Header + Body)',
			name: 'text',
			type: 'string',
			default: '',
			description: 'Full-text search across headers AND body',
		},
		{
			displayName: 'To',
			name: 'to',
			type: 'string',
			default: '',
			description: 'Substring of the To header',
		},
		{
			displayName: 'UID Range',
			name: 'uid',
			type: 'string',
			default: '',
			placeholder: '1:100',
			description: 'Explicit UID or range, e.g. "42" or "1:100"',
		},
	],
};

export const searchOptions: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: {
		show: {
			resource: ['email'],
			operation: ['search'],
		},
	},
	options: [
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
		},
		{
			displayName: 'Include Body',
			name: 'includeBody',
			type: 'boolean',
			default: false,
			description: 'Whether to also fetch plain-text/HTML body for each match (slower)',
		},
		{
			displayName: 'Include Headers',
			name: 'includeHeaders',
			type: 'boolean',
			default: false,
			description: 'Whether to include full header map in the output',
		},
		{
			displayName: 'Newest First',
			name: 'newestFirst',
			type: 'boolean',
			default: true,
			description: 'Whether to sort results with the newest messages first',
		},
	],
};

/* ------------------------------------------------------------------ */
/* GET options                                                        */
/* ------------------------------------------------------------------ */

export const getOptions: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: {
		show: {
			resource: ['email'],
			operation: ['get'],
		},
	},
	options: [
		{
			displayName: 'Include Attachments',
			name: 'includeAttachments',
			type: 'boolean',
			default: false,
			description: 'Whether to attach binary data for every attachment found',
		},
		{
			displayName: 'Include Headers',
			name: 'includeHeaders',
			type: 'boolean',
			default: false,
			description: 'Whether to include the full header map in the JSON output',
		},
		{
			displayName: 'Mark As Read',
			name: 'markAsRead',
			type: 'boolean',
			default: false,
			description: 'Whether to mark the message as read after fetching',
		},
	],
};

/* ------------------------------------------------------------------ */
/* Mailbox-only fields                                                */
/* ------------------------------------------------------------------ */

export const mailboxNameField: INodeProperties = {
	displayName: 'Mailbox Name',
	name: 'mailboxName',
	type: 'string',
	default: '',
	description: 'Name/path of the mailbox to create, delete or inspect',
	displayOptions: {
		show: {
			resource: ['mailbox'],
			operation: ['create', 'delete', 'rename', 'status', 'quota'],
		},
	},
	required: true,
};

export const mailboxNewNameField: INodeProperties = {
	displayName: 'New Name',
	name: 'newName',
	type: 'string',
	default: '',
	description: 'New mailbox path when renaming',
	displayOptions: {
		show: {
			resource: ['mailbox'],
			operation: ['rename'],
		},
	},
	required: true,
};

/* ------------------------------------------------------------------ */
/* Append + Download                                                  */
/* ------------------------------------------------------------------ */

export const appendSourceField: INodeProperties = {
	displayName: 'Source',
	name: 'appendSource',
	type: 'options',
	default: 'text',
	description: 'Where the raw RFC822 message comes from',
	displayOptions: {
		show: { resource: ['email'], operation: ['append'] },
	},
	options: [
		{ name: 'Text Field', value: 'text', description: 'Paste raw RFC822 in next field' },
		{ name: 'Binary Data', value: 'binary', description: 'Use a binary property from input' },
	],
};

export const appendRawField: INodeProperties = {
	displayName: 'Raw RFC822',
	name: 'rawMessage',
	type: 'string',
	typeOptions: { rows: 6 },
	default: '',
	description: 'Full message including headers (From, To, Subject, blank line, body)',
	displayOptions: {
		show: { resource: ['email'], operation: ['append'], appendSource: ['text'] },
	},
};

export const appendBinaryField: INodeProperties = {
	displayName: 'Binary Property',
	name: 'binaryProperty',
	type: 'string',
	default: 'data',
	description: 'Name of the binary property containing the .eml bytes',
	displayOptions: {
		show: { resource: ['email'], operation: ['append'], appendSource: ['binary'] },
	},
};

export const downloadAttachmentFilter: INodeProperties = {
	displayName: 'Attachment Filter',
	name: 'attachmentFilter',
	type: 'collection',
	placeholder: 'Add Filter',
	default: {},
	description: 'Optional filter to only download a subset of attachments',
	displayOptions: {
		show: { resource: ['download'], operation: ['downloadAttachments'] },
	},
	options: [
		{
			displayName: 'Filename Contains',
			name: 'filename',
			type: 'string',
			default: '',
			description: 'Case-insensitive substring match on the attachment filename',
		},
		{
			displayName: 'MIME Type',
			name: 'mimeType',
			type: 'string',
			default: '',
			placeholder: 'application/pdf or image/*',
			description: 'Full MIME type, or wildcard like "image/*"',
		},
	],
};
