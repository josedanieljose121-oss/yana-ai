
import express from "express";
import crypto from "node:crypto";

const app = express();
app.use(express.json({ limit: "30kb" }));

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.YAN_PASSWORD;
const SECRET = process.env.SESSION_SECRET;

const COOKIE = "yan_access";

function sign(value) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(value)
    .digest("hex");
}

function createToken() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return `${expires}.${sign(String(expires))}`;
}

function validToken(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)yan_access=([^;]+)/);
  if (!match) return false;

  const parts = match[1].split(".");
  if (parts.length !== 2) return false;

  const [expires, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) {
    return false;
  }

  const expected = Buffer.from(sign(expires));
  const received = Buffer.from(signature);

  return expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);
}

function requireAuth(req, res, next) {
  if (!validToken(req)) {
    return res.status(401).json({ error: "Acceso privado. Inicia sesión." });
  }
  next();
}

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

app.post("/api/login", (req, res) => {
  if (!PASSWORD || !SECRET) {
    return res.status(500).json({
      error: "El acceso privado no está configurado."
    });
  }

  const password = req.body?.password;

  if (typeof password !== "string" || password !== PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  res.cookie(COOKIE, createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });

  res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ success: true });
});

app.post("/api/chat", requireAuth, async (req, res) => {
  try {
    const key = process.env.GROQ_API_KEY;

    if (!key) throw new Error("Falta configurar GROQ_API_KEY");

    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
          .filter(m =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string"
          )
          .slice(-20)
      : [];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "system",
              content: `
Eres IA YAN, una inteligencia artificial con identidad propia.

IDENTIDAD:
- Tu nombre es IA YAN.
- Fuiste creada por tu desarrollador, quien es tu creador.
- Eres su asistente privada.
- Cuando te pregunten quién te creó, responde que tu creador es el dueño de IA YAN.
- Nunca inventes el nombre de tu creador.

PERSONALIDAD:
- Inteligente, creativa, divertida y amigable.
- Tienes una forma propia de expresarte.
- Eres honesta y reconoces cuando no sabes algo.
- Respondes en español.
- Utilizas emojis naturalmente.
- Ayudas con programación, tecnología, estudios y creatividad.

IMPORTANTE:
No afirmes que eres un modelo entrenado desde cero.
Tu identidad es IA YAN.
              `
            },
            ...messages
          ],
          temperature: 0.8
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Error de Groq");
    }

    res.json({
      reply: data.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log("IA YAN está funcionando en el puerto " + PORT);
});
