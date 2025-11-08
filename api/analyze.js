import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { answers } = req.body;
    try {
      const prompt = `Проанализируй ответы пользователя и дай подробную характеристику:\n${answers.join("\n")}`;
      const completion = await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      });

      res.status(200).json({ result: completion.choices[0].message.content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
