import express from 'express';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';
import { parseHtmlH1H2Tables } from './lib/functions/parse';
import { uploadParsedFile } from './lib/functions/upload';

// Load environment variables
dotenv.config();

/**
 * Environment variables interface.
 */
export interface Env {
	API_KEY: string;
	PORT?: string | number;
	R2_BUCKET_NAME: string;
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	R2_ENDPOINT: string;
}

const env: Env = {
	API_KEY: process.env.API_KEY || '',
	PORT: process.env.PORT || 3000,
	R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
	R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
	R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
	R2_ENDPOINT: process.env.R2_ENDPOINT || '',
};

// Initialize Express app
const app = express();
const PORT = env.PORT;

/**
 * Express route handler for parsing and uploading HTML content.
 *
 * 1. Retrieves the `file` and `userId` query parameters from the request URL.
 * 2. Ensures both parameters exist; returns an error response if either is missing.
 * 3. Fetches the HTML content from the `fileUrl`, throwing an error if the request fails.
 * 4. Parses the HTML content into a JSON structure using `parseHtmlH1H2Tables`.
 * 5. Uploads the parsed JSON using `uploadParsedFile` and returns the result as a JSON response.
 *
 * @async
 * @function
 * @param {express.Request} req - The incoming HTTP request.
 * @param {express.Response} res - The HTTP response object.
 * @returns {Promise<void>} A Promise that resolves to no value but sends an HTTP response:
 *  - 200 on success with a JSON payload of the uploaded result.
 *  - 400 if `file` or `userId` query parameters are missing.
 *  - 500 if an error occurs while fetching or processing the HTML content.
 */
app.get('/parse-and-upload', async (req: express.Request, res: express.Response): Promise<void> => {
	const apiKey: string | undefined = req.headers['x-api-key'] as string;
	if (!apiKey || apiKey !== env.API_KEY) {
		res.status(401).send('Unauthorized: Invalid or missing Api Key (x-api-key)');
		return;
	}

	const fileUrl: string | undefined = req.query.file as string;
	const userId: string | undefined = req.query.userId as string;

	if (!fileUrl) {
		res.status(400).send('Missing file parameter');
		return;
	}

	if (!userId) {
		res.status(400).send('Missing userId parameter');
		return;
	}

	try {
		// Fetch the HTML file from the provided URL
		const response = await fetch(fileUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.statusText}`);
		}

		const htmlContent: string = await response.text();

		// Parse the HTML into JSON
		const jsonResult = parseHtmlH1H2Tables(htmlContent);

		const { body } = await uploadParsedFile({ jsonResult, userId, env });

		res.status(200).json(JSON.parse(body));
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('Error:', errorMessage);
		res.status(500).send(`Error: ${errorMessage}`);
	}
});

// HTTPS server options
const options: https.ServerOptions = {
	key: fs.readFileSync('./key.pem'),
	cert: fs.readFileSync('./cert.pem'),
};

// Create and start HTTPS server
https.createServer(options, app).listen(PORT, () => {
	console.log(`HTTPS server running on https://localhost:${PORT}`);
});
