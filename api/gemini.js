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
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing on Vercel' });
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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: contents })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Failed to fetch from Gemini API");
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Serverless Function Error:", error);
        res.status(500).json({ error: error.message });
    }
}
