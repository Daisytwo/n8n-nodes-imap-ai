import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ImapFlow } from 'imapflow';

/**
 * Connection-Helper.
 *
 * Pro Node-Execute bauen wir eine frische IMAP-Verbindung auf und schließen
 * sie im `finally`-Block wieder. Ein echter Connection-Pool über Executions
 * hinweg würde voraussetzen, dass n8n eine Shared-Runtime-State-API bietet —
 * die gibt es in der stabilen Node-API v1 nicht. Wir halten die Verbindung
 * innerhalb eines einzigen `execute()`-Laufs aber offen, sodass viele
 * Operationen auf denselben Socket gehen.
 */

export interface ImapConnectionOptions {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	password?: string;
	accessToken?: string;
	authentication: 'password' | 'oauth2';
	tlsOptions: {
		rejectUnauthorized?: boolean;
		minVersion?: string;
		servername?: string;
	};
	advanced: {
		connectionTimeout?: number;
		disableCompress?: boolean;
	};
}

/**
 * Liest Credentials aus n8n und baut ein typisiertes Options-Objekt.
 */
export async function getImapOptions(
	context: IExecuteFunctions,
): Promise<ImapConnectionOptions> {
	const creds = await context.getCredentials('imapApi');

	return {
		host: creds.host as string,
		port: creds.port as number,
		secure: creds.secure as boolean,
		user: creds.user as string,
		password: (creds.password as string) || undefined,
		accessToken: (creds.accessToken as string) || undefined,
		authentication: (creds.authentication as 'password' | 'oauth2') ?? 'password',
		tlsOptions: (creds.tlsOptions as ImapConnectionOptions['tlsOptions']) ?? {},
		advanced: (creds.advanced as ImapConnectionOptions['advanced']) ?? {},
	};
}

/**
 * Erstellt und verbindet einen ImapFlow-Client.
 * Wirft `NodeOperationError` bei Verbindungs- oder Auth-Problemen, damit
 * das n8n-UI eine saubere Fehlermeldung rendert statt eines Raw-Stacktrace.
 */
export async function createImapClient(
	context: IExecuteFunctions,
	opts?: ImapConnectionOptions,
): Promise<ImapFlow> {
	const options = opts ?? (await getImapOptions(context));

	const clientConfig: ConstructorParameters<typeof ImapFlow>[0] = {
		host: options.host,
		port: options.port,
		secure: options.secure,
		// imapflow-Logging silencen; n8n hat ein eigenes Logging-System
		logger: false,
		tls: {
			rejectUnauthorized: options.tlsOptions?.rejectUnauthorized ?? true,
			minVersion: (options.tlsOptions?.minVersion as
				| 'TLSv1'
				| 'TLSv1.1'
				| 'TLSv1.2'
				| 'TLSv1.3'
				| undefined) ?? 'TLSv1.2',
			servername: options.tlsOptions?.servername || undefined,
		},
		// 30 s default — für langsame Mobile-Proxies ggf. hochdrehen
		socketTimeout: options.advanced?.connectionTimeout ?? 30000,
		disableCompression: options.advanced?.disableCompress ?? false,
		auth:
			options.authentication === 'oauth2'
				? { user: options.user, accessToken: options.accessToken ?? '' }
				: { user: options.user, pass: options.password ?? '' },
	};

	const client = new ImapFlow(clientConfig);

	try {
		await client.connect();
	} catch (err) {
		throw new NodeOperationError(
			context.getNode(),
			`IMAP connection failed: ${(err as Error).message}`,
			{ description: 'Check host, port, credentials and TLS settings.' },
		);
	}

	return client;
}

/**
 * Sauberes Trennen — schluckt Errors im Disconnect, damit wir beim
 * Aufräumen keinen echten Execution-Error überschreiben.
 */
export async function safeLogout(client: ImapFlow | undefined): Promise<void> {
	if (!client) return;
	try {
		await client.logout();
	} catch {
		// egal — Socket war evtl. schon zu
	}
}
