import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ParsedData } from './parse';
import { Env } from '../../index2';

/**
 * Uploads parsed data to an R2 bucket using the S3 API, generating a unique object key based on the current timestamp and the user's ID.
 *
 * 1. Converts the parsed JSON data to a string.
 * 2. Constructs a unique object key by combining the current timestamp and the user's ID.
 * 3. Uploads the serialized JSON to the R2 bucket via the S3 API.
 * 4. Returns a JSON string containing the CDN URL of the uploaded file in the `body` property.
 *
 * @async
 * @function uploadParsedFile
 * @param {Object} options - The options to configure the upload.
 * @param {ParsedData} options.jsonResult - The parsed JSON data to be uploaded.
 * @param {string} options.userId - The ID of the user associated with the data.
 * @param {Object} options.env - The environment containing configuration for S3 access.
 * @param {string} options.env.R2_BUCKET_NAME - The name of the R2 bucket.
 * @param {string} options.env.R2_ACCESS_KEY_ID - The access key ID for the R2 API.
 * @param {string} options.env.R2_SECRET_ACCESS_KEY - The secret access key for the R2 API.
 * @param {string} options.env.R2_ENDPOINT - The custom endpoint URL for the R2 API.
 * @returns {Promise<{ body: string }>} A promise that resolves to an object containing:
 *  - `body` (string): A JSON-serialized string with the publicly accessible URL for the uploaded file.
 * @throws {Error} Throws an error if the S3 `putObject` operation fails or if any other issue occurs during the upload.
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
export const uploadParsedFile = async ({
	jsonResult,
	userId,
	env,
}: {
	jsonResult: ParsedData;
	userId: string;
	env: Env;
}): Promise<{ body: string }> => {
	// Create S3 client for R2
	const s3 = new S3Client({
		region: 'auto', // R2 uses 'auto' as the region
		endpoint: env.R2_ENDPOINT, // R2-specific endpoint
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		},
	});

	// Convert the JSON object to a string
	const jsonString = JSON.stringify(jsonResult, null, 2);

	// Generate a unique object key
	const objectKey = `${Date.now()}-${userId}-data`;

	try {
		// Upload the object to R2 using the S3 API
		const command = new PutObjectCommand({
			Bucket: env.R2_BUCKET_NAME,
			Key: objectKey,
			Body: jsonString,
			ContentType: 'application/json',
		});

		await s3.send(command);

		// Return the public URL for the uploaded file
		const body = JSON.stringify({
			url: `https://cdn.cod-stats.jconet.ltd/${objectKey}`,
		});

		return { body };
	} catch (error) {
		throw new Error(`Failed to upload file to R2: ${(error as Error).message}`);
	}
};
