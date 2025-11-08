// api/analyze.js
import OpenAI from "openai";
import { Document, Paragraph, Packer, TextRun } from "docx";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не разрешен" });
    return;
  }

  try {
    const body = req.body ?? (await parseJsonBody(req));
    const { answers } = body;

    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: "Нет ответов" });
      return;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Сформируем подсказку — аккуратно, не слишком длинную, чтобы не переполнить токены
    let promptIntro = `Ты — внимательный профессиональный психолог. На основе письменных ответов участника составь подробный психологический профиль на русском языке.\n\nТребования:\n- Проанализируй эмоциональный тон, паттерны мышления, признаки тревожности/самооценки, эмпатию, стиль привязанности, экстраверсию/интроверсию, склонность к манипуляциям, ответственность, зрелость и исполнительность.\n- Разбей анализ на тематические блоки (заголовки блоков).\n- В конце дай краткий общий вывод (1–2 абзаца) и 3 практических рекомендации (коротко).\n- Пиши уважительно и конструктивно.\n\nДалее идут вопросы и ответы:\n\n`;

    // Добавляем ответы — ограничим длину сообщений, но передадим хотя бы ключевые
    // Соберём в одну строку, разделяя блоки; контроль длины в случае длинных ответов
    let qaText = "";
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      // Обрезаем каждую ответ-строку до разумного предела (например 1200 символов) чтобы не перегреть prompt
      const ansShort = String(a.answer).slice(0, 1200);
      qaText += `${i+1}. ${a.question}\nОтвет: ${ansShort}\n\n`;
    }

    const userContent = promptIntro + qaText;

    // Запрос в OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "Ты — профессиональный психолог. Ответы должны быть на русском языке." },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 3000
    });

    const analysis = completion.choices?.[0]?.message?.content ?? "Модель не вернула анализа.";

    // Формируем .docx (коротко: заголовок, ответы, анализ)
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [ new TextRun({ text: "Результат анализа психологической анкеты", bold: true, size: 28 }) ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [ new TextRun({ text: "Ответы респондента:", bold: true }) ] })
          ]
        }
      ]
    });

    // Добавим ответы (ограничим число параграфов чтобы файл не был чрезмерно большим)
    for (const a of answers) {
      doc.addSection({
        children: [
          new Paragraph({ children: [ new TextRun({ text: a.question, bold: true }) ] }),
          new Paragraph({ text: `Ответ: ${a.answer}` }),
          new Paragraph({ text: "" })
        ]
      });
    }

    //Добавим анализ
    const analysisLines = String(analysis).split(/\r?\n/).filter(Boolean);
    doc.addSection({
      children: [
        new Paragraph({ text: "" }),
        new Paragraph({ children: [ new TextRun({ text: "Анализ:", bold: true }) ] }),
        ...analysisLines.map(l => new Paragraph({ text: l }))
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    const docBase64 = buffer.toString("base64");

    // Ответ клиенту
    res.status(200).json({ analysis, docBase64 });

  } catch (err) {
    console.error("api/analyze error:", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
}

// Helper: if req.body is a stream (older runtimes), try to parse raw JSON
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", e => reject(e));
  });
}
