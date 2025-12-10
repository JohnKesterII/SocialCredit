// api/send-code.js
const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { email, code } = JSON.parse(req.body || "{}");

    if (!email || !code) {
      res.status(400).json({ error: "Missing email or code" });
      return;
    }

    // Configure transporter with your SMTP details
    // Set these env vars in Vercel: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: process.env.FROM_EMAIL || `"Vote Leaderboard" <no-reply@example.com>`,
      to: email,
      subject: "Your verification code",
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <strong>${code}</strong></p>`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("send-code error", err);
    res.status(500).json({ error: "Failed to send email" });
  }
};
