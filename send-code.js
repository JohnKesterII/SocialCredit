// api/send-code.js
// Node.js serverless function for Vercel

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.json({ error: "Only POST allowed" });
    return;
  }

  // Read raw body (Vercel doesn't auto-parse in plain Node functions)
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", resolve);
  });

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch (e) {
    res.statusCode = 400;
    res.json({ error: "Invalid JSON" });
    return;
  }

  const { email, code } = parsed || {};

  if (!email || !code) {
    res.statusCode = 400;
    res.json({ error: "Missing email or code" });
    return;
  }

  try {
    // IMPORTANT:
    // Use the exact "from" address Resend shows you in their dashboard.
    // For many accounts it's something like: "Acme <onboarding@resend.dev>"
    // Temporarily you can use this, but ideally copy from Resend's example:
    const fromAddress = "Vote Leaderboard <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: "Your verification code",
        html: `<p>Your verification code is <strong>${code}</strong>.</p>`
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Resend API error:", response.status, data);
      res.statusCode = 500;
      res.json({
        error: "Resend API error",
        detail: data
      });
      return;
    }

    res.statusCode = 200;
    res.json({ ok: true });
  } catch (err) {
    console.error("Email failed:", err);
    res.statusCode = 500;
    res.json({ error: "Failed to send email" });
  }
};
