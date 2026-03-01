export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, image, mimeType } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Vercel will automatically inject this from the project's Environment Variables settings
        const API_KEY_ENV = process.env.GEMINI_API_KEY;

        if (!API_KEY_ENV) {
            return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing on Vercel' });
        }

        // Split by comma in case there are multiple keys stored dynamically
        const apiKeys = API_KEY_ENV.split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (apiKeys.length === 0) {
            return res.status(500).json({ error: 'No valid API keys found in GEMINI_API_KEY environment variable' });
        }

        let contents = [{ parts: [{ text: prompt }] }];
        if (image && mimeType) {
            contents[0].parts.push({
                inline_data: {
                    mime_type: mimeType,
                    data: image
                }
            });
        }

        let lastError = null;

        // Try every single key provided in the environment variable array sequentially
        for (let i = 0; i < apiKeys.length; i++) {
            const currentKey = apiKeys[i];
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: contents })
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMessage = data.error?.message || "Unknown error";
                    console.warn(`Key index ${i} failed. Reason: ${errorMessage}`);
                    lastError = new Error(errorMessage);

                    // If the Key throws a 429 (Too many requests/quota exceeded), loop to the next one
                    // But WAIT 1.5 Seconds so Google doesn't globally IP-ban the Vercel server for instantaneous bursting
                    if (response.status === 429 || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('busy')) {
                        const delay = (ms) => new Promise(res => setTimeout(res, ms));
                        console.log("Sleeping for 1.5 seconds to bypass burst-protection...");
                        await delay(1500);
                        continue;
                    }

                    // If it's a different deadly error (like a 400 Bad Request), don't bother exhausting the remaining keys
                    throw lastError;
                }

                // First key that returns 200 OK breaks out of the loop and immediately fulfills the client request
                return res.status(200).json(data);

            } catch (err) {
                lastError = err;
                // If there's a total network failure executing the fetch block, try the next key
                continue;
            }
        }

        // If the loop concludes without a positive return, throw the final error tracked
        throw lastError || new Error("All provided API keys failed to execute the request.");

    } catch (error) {
        console.error("Serverless Function Final Error:", error);
        res.status(500).json({ error: error.message });
    }
}
