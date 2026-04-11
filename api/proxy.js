export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Missing URL" });
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://www.google.com/"
      }
    });

    const text = await response.text();

    // ❗ detect HTML block
    if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
      return res.status(500).json({
        error: "Provider blocked request (HTML returned)"
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(text);

  } catch (e) {
    res.status(500).json({
      error: "Proxy failed",
      message: e.message
    });
  }
}
