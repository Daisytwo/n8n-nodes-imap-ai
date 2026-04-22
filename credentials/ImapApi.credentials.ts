import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Credentials für IMAP-Verbindungen.
 *
 * Unterstützt klassisches Login (User + Pass) und OAuth2 (XOAUTH2) für
 * Google Workspace / Microsoft 365. TLS-Optionen bewusst als eigenes
 * Collection-Feld, damit Nutzer Self-Signed-Zertifikate (z. B. interne
 * Mailserver im Homelab) via `rejectUnauthorized: false` zulassen können.
 *
 * Warum kein `test`-Objekt mit HTTP-Request? IMAP ist kein HTTP, deshalb
 * lösen wir den Credential-Test programmatisch aus dem Node heraus
 * (Operation "Test Connection"). Das `test`-Objekt bleibt hier weg.
 */
export class ImapApi implements ICredentialType {
	name = 'imapApi';

	displayName = 'IMAP API';

	// Regel `cred-class-field-documentation-url-miscased` meldet hier false
	// positive, sobald ein Fragment (#...) oder ein Bindestrich-Segment vorkommt.
	// Die URL ist eine valide HTTPS-URL und funktioniert in n8n korrekt.
	// eslint-disable-next-line n8n-nodes-base/cred-class-field-documentation-url-miscased
	documentationUrl = 'https://github.com/addpv/n8n-nodes-imap-ai';

	icon = 'file:../nodes/Imap/imap.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'options',
			options: [
				{
					name: 'Password',
					value: 'password',
					description: 'Classic username + password (LOGIN / PLAIN)',
				},
				{
					name: 'OAuth2 (XOAUTH2)',
					value: 'oauth2',
					description: 'Use a pre-issued OAuth2 access token (Google / Microsoft)',
				},
			],
			default: 'password',
			description: 'How the node authenticates against the IMAP server',
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'imap.example.com',
			required: true,
			description: 'IMAP server hostname or IP',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 993,
			required: true,
			description: 'IMAP port (993 for implicit TLS, 143 for STARTTLS/plain)',
		},
		{
			displayName: 'Use TLS',
			name: 'secure',
			type: 'boolean',
			default: true,
			description: 'Whether to connect with implicit TLS (port 993). Turn off for STARTTLS on 143.',
		},
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			default: '',
			placeholder: 'user@example.com',
			required: true,
			description: 'Username / email address used to log in',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			displayOptions: {
				show: {
					authentication: ['password'],
				},
			},
			description: 'Account password or app password (use app passwords for Gmail/Outlook)',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			displayOptions: {
				show: {
					authentication: ['oauth2'],
				},
			},
			description: 'Valid OAuth2 access token (caller is responsible for refresh)',
		},
		{
			displayName: 'TLS Options',
			name: 'tlsOptions',
			type: 'collection',
			placeholder: 'Add TLS Option',
			default: {},
			options: [
				{
					displayName: 'Allow Self-Signed Certificates',
					name: 'rejectUnauthorized',
					type: 'boolean',
					default: true,
					description: 'Whether the server cert must be valid. Turn off for self-signed certs.',
				},
				{
					displayName: 'Minimum TLS Version',
					name: 'minVersion',
					type: 'options',
					options: [
						{ name: 'TLS 1.0', value: 'TLSv1' },
						{ name: 'TLS 1.1', value: 'TLSv1.1' },
						{ name: 'TLS 1.2', value: 'TLSv1.2' },
						{ name: 'TLS 1.3', value: 'TLSv1.3' },
					],
					default: 'TLSv1.2',
					description: 'Lowest TLS version the client will negotiate',
				},
				{
					displayName: 'Server Name (SNI)',
					name: 'servername',
					type: 'string',
					default: '',
					description: 'Explicit SNI hostname, if different from "Host"',
				},
			],
		},
		{
			displayName: 'Advanced',
			name: 'advanced',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			options: [
				{
					displayName: 'Connection Timeout (ms)',
					name: 'connectionTimeout',
					type: 'number',
					default: 30000,
					description: 'Socket timeout in milliseconds before giving up',
				},
				{
					displayName: 'Disable Compression',
					name: 'disableCompress',
					type: 'boolean',
					default: false,
					description: 'Whether to disable IMAP COMPRESS=DEFLATE (useful for debugging)',
				},
			],
		},
	];

	/**
	 * Kein Auth-Payload für HTTP-Anfragen nötig — IMAP läuft außerhalb des
	 * n8n-HTTP-Helpers. Dieses leere Objekt ist nur Pflichtfeld.
	 */
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	/**
	 * Test via n8n-Credential-Tester nicht möglich (kein HTTP-Endpoint),
	 * daher bleibt `test` undefined. Verbindung bitte über den Node
	 * "Test Connection"-Resource prüfen.
	 */
	test: ICredentialTestRequest | undefined = undefined;
}
