// Tiny email endpoint: no auth, no database. Run with `npm run server`.
import express from 'express'
import nodemailer from 'nodemailer'

const app = express()
app.use(express.json({ limit: '15mb' }))

app.post('/api/send', async (req, res) => {
  const { to, subject, message, filename, pdf } = req.body || {}
  if (!to || !pdf) return res.status(400).json({ error: 'Missing recipient or PDF.' })
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to, subject, text: message,
      attachments: [{ filename, content: pdf, encoding: 'base64' }]
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Email endpoint on http://localhost:3001'))
