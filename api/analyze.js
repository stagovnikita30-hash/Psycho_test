import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: JSON.stringify(req.body) }]
    });

    res.status(200).json({ result: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
