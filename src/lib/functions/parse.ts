import { DomUtils, parseDocument } from 'htmlparser2';
import { H1_WHITELIST, H2_WHITELIST } from '../constants/whitelist';

export interface ParsedData {
	[h1Heading: string]: {
		[h2Heading: string]: Array<Record<string, string>>;
	};
}

/**
 * Parses an HTML string to extract whitelisted H1 sections and their corresponding H2 headings,
 * along with the first table following each H2. Returns a structured JSON object of the extracted data.
 *
 * - Searches for all `<h1>` elements in the provided HTML.
 * - Skips any `<h1>` elements not present in a predefined whitelist.
 * - Within each valid `<h1>` section, iterates through `<h2>` elements (also applying a whitelist check).
 * - For each valid `<h2>`, locates the next `<table>` sibling and transforms it into an array of objects.
 * - Aggregates these results into a nested object keyed by whitelisted H1/H2 text.
 *
 * @function parseHtmlH1H2Tables
 * @param {string} html - The raw HTML string to parse.
 * @returns {ParsedData} A nested object containing the parsed table data, keyed by whitelisted H1 and H2 headings.
 * @throws {Error} May throw if the underlying DOM parsing fails or if data is otherwise unreadable.
 *
 * @example
 * // Example usage:
 * const sampleHtml = `
 *   <h1>SECTION_ONE</h1>
 *   <h2>SUBSECTION_A</h2>
 *   <table>
 *     <tr><th>Header1</th><th>Header2</th></tr>
 *     <tr><td>Data1</td><td>Data2</td></tr>
 *   </table>
 *   <h2>SUBSECTION_B</h2>
 *   <table>
 *     <tr><th>Header3</th><th>Header4</th></tr>
 *     <tr><td>Data3</td><td>Data4</td></tr>
 *   </table>
 * `;
 *
 * const parsedData = parseHtmlH1H2Tables(sampleHtml);
 * console.log(parsedData);
 * // Example result:
 * // {
 * //   SECTION_ONE: {
 * //     SUBSECTION_A: [ { Header1: 'Data1', Header2: 'Data2' } ],
 * //     SUBSECTION_B: [ { Header3: 'Data3', Header4: 'Data4' } ]
 * //   }
 * // }
 */
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

/**
 * Parses a single HTML `<table>` node and returns an array of objects representing its rows.
 *
 * 1. Extracts table headers from the `<th>` elements.
 * 2. Iterates over each `<tr>` row.
 * 3. Collects `<td>` data, matching each cell to the corresponding header.
 * 4. Constructs an object for each row, using headers as keys and their cell contents as values.
 * 5. Filters out rows with a mismatch in `<td>` vs. `<th>` count.
 *
 * @function parseSingleTable
 * @param {any} tableNode - The parsed DOM node representing the `<table>` element.
 *                          Ideally should be a typed node from a DOM library, but typed as `any`
 *                          for flexibility if the library doesn't provide strict types.
 * @returns {Array<Record<string, string>>} An array of objects, where each object’s keys
 *                                         come from the table headers, and values come from
 *                                         the corresponding table cells.
 * @throws {Error} Throws if the DOM structure is invalid or cannot be read properly.
 *
 * @example
 * // Example usage:
 * const tableHtml = `
 *   <table>
 *     <thead>
 *       <tr><th>Column1</th><th>Column2</th></tr>
 *     </thead>
 *     <tbody>
 *       <tr><td>Row1Data1</td><td>Row1Data2</td></tr>
 *       <tr><td>Row2Data1</td><td>Row2Data2</td></tr>
 *     </tbody>
 *   </table>
 * `;
 *
 * // Assuming parseDocument is from 'htmlparser2' or a similar library
 * const tableNode = parseDocument(tableHtml);
 * const result = parseSingleTable(tableNode);
 *
 * console.log(result);
 * // [
 * //   { Column1: 'Row1Data1', Column2: 'Row1Data2' },
 * //   { Column1: 'Row2Data1', Column2: 'Row2Data2' }
 * // ]
 */
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

/**
 * Searches the siblings following a given `<h2>` node in the DOM tree to find the next `<table>` node.
 *
 * 1. Iterates through subsequent siblings of the provided `<h2>` node.
 * 2. Returns `null` if another `<h2>` or any `<h1>` is encountered before finding a `<table>`,
 *    indicating that no table exists within this section.
 * 3. Returns the `<table>` node once it is found.
 * 4. If the end of the siblings is reached without finding a `<table>`, returns `null`.
 *
 * @function findNextTableSibling
 * @param {any} h2Node - The DOM node representing an `<h2>` element.
 *                       (Typed as `any` for flexibility if the DOM library does not have strict types.)
 * @returns {any | null} - The `<table>` DOM node if found, otherwise `null`.
 *
 * @example
 * // Example usage:
 * // Suppose 'h2Node' is an <h2> DOM element you've already located in a parsed HTML document.
 * const tableNode = findNextTableSibling(h2Node);
 * if (tableNode) {
 *   // Do something with the discovered <table>, for example:
 *   const data = parseSingleTable(tableNode);
 *   console.log('Parsed data from the next table sibling:', data);
 * } else {
 *   console.log('No <table> found before another <h2> or <h1>.');
 * }
 */
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
