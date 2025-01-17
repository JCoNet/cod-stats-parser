import { parseDocument } from 'htmlparser2';
import { DomUtils } from 'htmlparser2';

interface ParsedData {
	[h1Heading: string]: {
		[h2Heading: string]: Array<Record<string, string>>;
	};
}

export const H1_WHITELIST = [
	'Call of Duty: Black Ops 6',
	'Call of Duty: Black Ops Cold War',
	'Activision Account Shared',
	'Call of Duty: Modern Warfare',
	'Call of Duty: Modern Warfare II',
	'Call of Duty: Modern Warfare III',
	'Call of Duty: Vanguard',
	'Call of Duty: Warzone 2.0',
	'Call of Duty: Warzone Mobile',
] as const;

export const H2_WHITELIST = [
	'Campaign Checkpoint Data (reverse chronological)',
	'Multiplayer Match Data (reverse chronological)',
	'PromoCodes',
	'Zombies Match Data (reverse chronological)',
	'Campaign Data (reverse chronological)',
	'Sessions Data (reverse chronological)',
	'Zombies Data (reverse chronological)',
	'Gamertag Data (reverse chronological)',
	'CoOp Match Data (reverse chronological)',
	'Mobile Hardware Data (reverse chronological)',
] as const;

export function parseHtmlH1H2Tables(html: string): ParsedData {
	const root = parseDocument(html);

	// Find all H1 tags
	const h1Elements = DomUtils.findAll((node) => node.type === 'tag' && node.name === 'h1', root);

	const parsed: ParsedData = {};

	// We'll iterate over each <h1>, then gather all <h2>/<table> pairs
	for (let i = 0; i < h1Elements.length; i++) {
		const h1Node = h1Elements[i];
		// Get the text of this H1
		const h1Text = DomUtils.textContent(h1Node).trim();

		// --- H1 WHITELIST CHECK ---
		if (!H1_WHITELIST.includes(h1Text as any)) {
			continue; // Skip if this H1 is not in the whitelist
		}

		// Create an object to hold all H2 data for this H1
		parsed[h1Text] = {};

		// Identify the *next* <h1> to know where our "section" ends
		const nextH1Node = h1Elements[i + 1] ?? null;

		// We'll walk all siblings after this H1 until we hit the next H1
		let sibling = h1Node.nextSibling;
		while (sibling && sibling !== nextH1Node) {
			if (sibling.type === 'tag' && sibling.name === 'h2') {
				// We found an H2 in the same "section" as the current H1
				const h2Text = DomUtils.textContent(sibling).trim();

				// --- H2 WHITELIST CHECK ---
				if (!H2_WHITELIST.includes(h2Text as any)) {
					sibling = sibling.nextSibling;
					continue; // Skip if H2 isn't whitelisted
				}

				// Parse the *first* table that appears after this H2
				const tableNode = findNextTableSibling(sibling);
				if (tableNode) {
					// Convert the table into array-of-objects
					const tableData = parseSingleTable(tableNode);

					// Assign it to parsed[h1][h2]
					parsed[h1Text][h2Text] = tableData;
				}
			}

			// Move on
			sibling = sibling.nextSibling;
		}
	}

	return parsed;
}

function parseSingleTable(tableNode: any): Array<Record<string, string>> {
	// Extract <th> to get headers
	const headers = DomUtils.findAll((node) => node.type === 'tag' && node.name === 'th', tableNode).map((th) =>
		DomUtils.textContent(th).trim()
	);

	// Find all <tr> rows
	const rows = DomUtils.findAll((node) => node.type === 'tag' && node.name === 'tr', tableNode);

	// Build array of objects from <td> matching <th> count
	const tableData: Record<string, string>[] = [];
	for (const row of rows) {
		const tds = DomUtils.findAll((node) => node.type === 'tag' && node.name === 'td', row);
		if (tds.length === headers.length) {
			const rowObj: Record<string, string> = {};
			tds.forEach((td, i) => {
				rowObj[headers[i]] = DomUtils.textContent(td).trim();
			});
			tableData.push(rowObj);
		}
	}

	return tableData;
}

function findNextTableSibling(h2Node: any) {
	let next = h2Node.nextSibling;
	while (next) {
		if (next.type === 'tag' && next.name === 'h2') {
			// Stopped because we found another H2 (no table in-between)
			return null;
		}
		if (next.type === 'tag' && next.name === 'h1') {
			// Stopped because we found next H1, means end of current H1 block
			return null;
		}
		if (next.type === 'tag' && next.name === 'table') {
			return next;
		}
		next = next.nextSibling;
	}
	return null;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const fileUrl = url.searchParams.get('file');
		const userId = url.searchParams.get('userId');

		if (!fileUrl) {
			return new Response('Missing file parameter', { status: 400 });
		}

		try {
			// Fetch the HTML file from the provided URL
			const response = await fetch(fileUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch file: ${response.statusText}`);
			}

			const htmlContent = await response.text();

			// Parse the HTML into JSON
			const jsonResult = parseHtmlH1H2Tables(htmlContent);

			// Convert the JSON object to a string
			const jsonString = JSON.stringify(jsonResult, null, 2);

			// We create a unique or fixed key. E.g., "myData.json"
			const objectKey = `${Date.now()}-${userId}-data`;

			// Put the object in R2. The second argument can be a string, ArrayBuffer, etc.
			await env.MY_BUCKET.put(objectKey, jsonString);

			// Return the json file url
			const body = JSON.stringify({ url: `https://cdn.cod-stats.jconet.ltd/${objectKey}` });
			return new Response(body, {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(`Error: ${error.message}`, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
