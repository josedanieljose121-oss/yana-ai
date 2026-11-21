

import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

app.post("/api/chat", async (req, res) => {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta configurar la clave API de Groq");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Eres YANA AI, una asistente inteligente, divertida, honesta y amable. Responde siempre en español."
          },
          ...(req.body.messages || []).slice(-20)
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Error de Groq");
    }

    res.json({ reply: data.choices[0].message.content });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3000);
