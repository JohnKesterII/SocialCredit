import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { email, code } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ error: "Missing email or code" });
  }

  try {
    await resend.emails.send({
      from: 'no-reply@resend.dev',
      to: email,
      subject: "Your verification code",
      html: `<p>Your verification code is: <strong>${code}</strong></p>`
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Email send failed:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
