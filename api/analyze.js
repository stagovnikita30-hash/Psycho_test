// api/analyze.js
import { Document, Packer, Paragraph, TextRun } from "docx";

/**
 * Серверная функция для Vercel.
 * Ожидает POST { fullText: "Q1...A1...Q160...A160..." }
 * Использует GROQ API (OpenAI-compatible endpoint).
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Метод не разрешён" });

  try {
    const { fullText } = req.body ?? {};
    if (!fullText || typeof fullText !== "string") {
      res.status(400).json({ error: "Неверный запрос: ожидался fullText" });
      return;
    }

    // Подготовка подсказки
    const systemInstr = `Ты — профессиональный психологический аналитик. На русском языке проанализируй ответы человека.
Разбей анализ на тематические блоки: эмпатия и близость, тревожность/нейротизм, самооценка, стиль привязанности, социальное поведение (экстраверсия/интроверсия), эмоциональная устойчивость, склонность к манипуляциям, зрелость и ответственность.
В конце — краткий общий вывод (1–2 абзаца) и 3 практических рекомендации. Пиши конструктивно и уважительно.`;

    const userContent = `Ниже — вопросы и ответы респондента:\n\n${fullText}\n\nДай детальный, структурированный анализ, без HTML и без служебных пометок.`;

    // Запрос в Groq (OpenAI-compatible endpoint)
    const body = {
      model: "compound-beta", // общая мощная модель Groq; можно заменить по желанию
      messages: [
        { role: "system", content: systemInstr },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 3000
    };

    const groqResp = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!groqResp.ok) {
      const text = await groqResp.text();
      console.error("Groq API error:", groqResp.status, text);
      return res.status(502).json({ error: `Groq API error ${groqResp.status}: ${text}` });
    }

    const groqJson = await groqResp.json();
    // безопасный путь к тексту
    const analysis = groqJson?.choices?.[0]?.message?.content ?? groqJson?.choices?.[0]?.text ?? JSON.stringify(groqJson);

    // Формируем docx
    const doc = new Document();
    const children = [];

    children.push(new Paragraph({ children: [ new TextRun({ text: "Результат анализа психологической анкеты", bold: true }) ] }));
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ children: [ new TextRun({ text: "Анализ:", bold: true }) ] }));

    // разбиваем анализ на строки и добавляем
    const lines = String(analysis).split(/\r?\n/);
    for (const ln of lines) {
      children.push(new Paragraph({ text: ln }));
    }

    doc.addSection({ children });

    const buffer = await Packer.toBuffer(doc);
    const docBase64 = buffer.toString("base64");

    // Возвращаем анализ и base64 docx
    res.status(200).json({ analysis, docBase64 });

  } catch (err) {
    console.error("api/analyze error:", err);
    res.status(500).json({ error: String(err) });
  }
}
