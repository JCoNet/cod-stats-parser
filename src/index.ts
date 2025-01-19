import { parseHtmlH1H2Tables } from './lib/functions/parse';
import { uploadParsedFile } from './lib/functions/upload';

export default {
	/**
	 * A Cloudflare Worker handler that processes an incoming Request to fetch and parse HTML content, then uploads the parsed data.
	 *
	 * 1. Retrieves the `file` and `userId` query parameters from the request URL.
	 * 2. Ensures both parameters exist; returns an error Response if either is missing.
	 * 3. Fetches the HTML content from the `fileUrl`, throwing an error if the request fails.
	 * 4. Parses the HTML content into a JSON structure using `parseHtmlH1H2Tables`.
	 * 5. Uploads the parsed JSON using `uploadParsedFile` and returns the result as a JSON response.
	 *
	 * @async
	 * @function fetch
	 * @param {Request} request - The incoming HTTP request to the Cloudflare Worker.
	 * @param {Env} env - The environment bindings (e.g., KV namespaces, secrets) for the Worker.
	 * @returns {Promise<Response>} A Promise that resolves to a Response object:
	 *  - 200 on success with JSON payload of the uploaded result.
	 *  - 400 if `file` or `userId` query parameters are missing.
	 *  - 500 if an error occurs while fetching or processing the HTML content.
	 * @throws {Error} Throws an error if fetching the specified HTML file fails (non-2xx status).
	 *
	 * @example
	 * // Example usage (inside a Worker test or event handler):
	 * const request = new Request('https://example.com?file=https://somesite.com/myFile.html&userId=abc123');
	 * const response = await fetch(request, env);
	 * console.log(await response.text()); // Logs the JSON string or an error message
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		const apiKey = request.headers.get('x-api-key');
		if (!apiKey || apiKey !== env.API_KEY) {
			return new Response('Unauthorized: Invalid or missing Api Key (x-api-key)', { status: 401 });
		}

		const url = new URL(request.url);
		const fileUrl = url.searchParams.get('file');
		const userId = url.searchParams.get('userId');

		if (!fileUrl) {
			return new Response('Missing file parameter', { status: 400 });
		}

		if (!userId) {
			return new Response('Missing userId parameter', { status: 400 });
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

			const { body } = await uploadParsedFile({ jsonResult, userId, env });

			return new Response(body, {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(`Error: ${error.message}`, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
