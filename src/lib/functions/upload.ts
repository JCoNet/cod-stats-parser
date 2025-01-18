import { ParsedData } from './parse';

/**
 * Uploads parsed data to an R2 bucket, generating a unique object key based on the current timestamp and the user's ID.
 *
 * 1. Converts the parsed JSON data to a string.
 * 2. Constructs a unique object key by combining the current timestamp and the user's ID.
 * 3. Uploads the serialized JSON to the specified R2 bucket via `env.MY_BUCKET`.
 * 4. Returns a JSON string containing the CDN URL of the uploaded file in the `body` property.
 *
 * @async
 * @function uploadParsedFile
 * @param {Object} options - The options to configure the upload.
 * @param {ParsedData} options.jsonResult - The parsed JSON data to be uploaded.
 * @param {string} options.userId - The ID of the user associated with the data.
 * @param {Env} options.env - The environment containing the R2 bucket (`MY_BUCKET`) and other bindings.
 * @returns {Promise<{ body: string }>} A promise that resolves to an object containing:
 *  - `body` (string): A JSON-serialized string with the publicly accessible URL for the uploaded file.
 * @throws {Error} Throws an error if the R2 `put` operation fails or if any other issue occurs during the upload.
 *
 * @example
 * // Example usage:
 * const jsonResult = { someKey: 'someValue' };
 * const userId = 'user123';
 *
 * const { body } = await uploadParsedFile({ jsonResult, userId, env });
 *
 * // body is a JSON string containing the URL of the uploaded file
 * const { url } = JSON.parse(body);
 * console.log('Uploaded file can be found at:', url);
 */
export const uploadParsedFile = async ({ jsonResult, userId, env }: { jsonResult: ParsedData; userId: string; env: Env }) => {
	// Convert the JSON object to a string
	const jsonString = JSON.stringify(jsonResult, null, 2);

	// We create a unique or fixed key. E.g., "myData.json"
	const objectKey = `${Date.now()}-${userId}-data`;

	// Put the object in R2. The second argument can be a string, ArrayBuffer, etc.
	await env.MY_BUCKET.put(objectKey, jsonString);

	// Return the json file url
	const body = JSON.stringify({ url: `https://cdn.cod-stats.jconet.ltd/${objectKey}` });

	return { body };
};
