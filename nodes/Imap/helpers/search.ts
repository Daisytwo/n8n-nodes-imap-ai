import type { SearchObject } from 'imapflow';

/**
 * Builder für IMAP-Search-Criteria.
 *
 * IMAP-Searches sind für LLMs schwer zu formulieren, wenn man direkt das
 * Wire-Format erwartet (z. B. `SINCE 1-Jan-2026 UNSEEN FROM "alice"`).
 * Deshalb akzeptieren wir ein flaches JSON-Objekt mit klaren Feldnamen,
 * das ein AI Agent leicht füllen kann, und übersetzen es nach imapflow.
 *
 * Jeder Key ist optional — alle gesetzten werden UND-verknüpft.
 */
export interface SearchInputRaw {
	/** RFC5322 From-Header (substring match, case-insensitive) */
	from?: string;
	/** To-Header */
	to?: string;
	/** Cc-Header */
	cc?: string;
	/** Subject-Substring */
	subject?: string;
	/** Freitext im gesamten Body (IMAP BODY) */
	body?: string;
	/** Freitext über Header UND Body (IMAP TEXT) */
	text?: string;
	/** Nur ungelesen */
	unseen?: boolean;
	/** Nur gelesen */
	seen?: boolean;
	/** Nur geflaggt (mit \Flagged) */
	flagged?: boolean;
	/** Nur beantwortet */
	answered?: boolean;
	/** Nur Emails mit Anhängen (approximiert via Larger-Filter) */
	hasAttachment?: boolean;
	/** ISO-Datum inkl. — seit diesem Tag (>=) */
	since?: string;
	/** ISO-Datum exkl. — vor diesem Tag (<) */
	before?: string;
	/** Minimale Größe in Bytes */
	larger?: number;
	/** Maximale Größe in Bytes */
	smaller?: number;
	/** UID-Range, z. B. "1:100" oder "12345" */
	uid?: string;
}

/**
 * Parst einen ISO-Datumsstring lose. Falls der String ungültig ist,
 * geben wir `undefined` zurück statt zu werfen — IMAP-Server mögen
 * keine Invalid-Dates.
 */
function parseDate(s?: string): Date | undefined {
	if (!s) return undefined;
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Übersetzt unsere flache SearchInputRaw in das von imapflow erwartete
 * SearchObject. Fehlende Felder werden weggelassen, keine `undefined`s
 * im Output — imapflow ist da streng.
 */
export function buildSearchQuery(input: SearchInputRaw | undefined): SearchObject {
	if (!input || Object.keys(input).length === 0) {
		// Leerer Filter = "alle" via ALL-Flag (imapflow-Konvention)
		return { all: true };
	}

	const q: SearchObject = {};

	if (input.from) q.from = input.from;
	if (input.to) q.to = input.to;
	if (input.cc) q.cc = input.cc;
	if (input.subject) q.subject = input.subject;
	if (input.body) q.body = input.body;
	if (input.text) q.text = input.text;

	if (input.unseen) q.seen = false;
	else if (input.seen) q.seen = true;

	if (input.flagged) q.flagged = true;
	if (input.answered) q.answered = true;

	const since = parseDate(input.since);
	const before = parseDate(input.before);
	if (since) q.since = since;
	if (before) q.before = before;

	if (typeof input.larger === 'number') q.larger = input.larger;
	if (typeof input.smaller === 'number') q.smaller = input.smaller;

	// IMAP hat keinen nativen "hasAttachment"-Filter. Größer-als-Heuristik
	// (> 50 KB) ist unsauber, aber besser als nichts. Echte Prüfung passiert
	// nach dem Fetch beim Mailparser.
	if (input.hasAttachment && typeof input.larger !== 'number') {
		q.larger = 50 * 1024;
	}

	if (input.uid) q.uid = input.uid;

	return q;
}
