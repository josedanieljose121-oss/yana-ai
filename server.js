
import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

app.post("/api/chat", async (req, res) => {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta configurar la clave API");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres YANA AI, una asistente inteligente, honesta y amable. Responde en español."
          },
          ...(req.body.messages || []).slice(-20)
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error de IA");

    res.json({ reply: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3000);
