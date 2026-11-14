export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const subPath = Array.isArray(req.query.path) ? req.query.path.join("/") : (req.query.path || "");
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/openai/${subPath}`;

  console.log("Proxying to:", targetUrl);
  console.log("Method:", req.method);
  console.log("Body:", JSON.stringify(req.body));

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        // ← 유니티에서 오는 Authorization 헤더 무시하고 서버 키로 강제 덮어쓰기
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
      },
      body: req.method !== "GET" && req.method !== "DELETE"
        ? JSON.stringify(req.body)
        : undefined,
    });

    const isStream = response.headers.get("content-type")?.includes("text/event-stream");

    if (isStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
      res.end();
    } else {
      const text = await response.text();
      console.log("Response from Helpy:", text);  // ← 로그로 실제 응답 확인
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (e) {
        // JSON 파싱 실패 시 원본 텍스트 그대로 반환 (디버깅용)
        res.status(response.status).send(text);
      }
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
}
