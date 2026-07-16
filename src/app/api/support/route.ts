import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface SupportPayload {
  kind?: 'support' | 'bug';
  name?: string;
  email?: string;
  message?: string;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : '';
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as SupportPayload;
  const kind = body.kind === 'bug' ? 'bug' : 'support';
  const name = clean(body.name) || 'AI DJ Studio user';
  const email = clean(body.email);
  const message = clean(body.message);

  if (!email || !message) {
    return NextResponse.json({ ok: false, message: 'Email and message are required.' }, { status: 400 });
  }

  const smtpUser = process.env.GMAIL_SMTP_USER;
  const smtpPass = process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!smtpUser || !smtpPass) {
    return NextResponse.json({
      ok: false,
      message: 'Support email is not configured yet. Add Gmail SMTP env values and try again.',
    }, { status: 503 });
  }

  const to = process.env.SUPPORT_TO_EMAIL ?? 'royshivamninja@gmail.com';
  const subject = `[AI DJ Studio] ${kind === 'bug' ? 'Bug report' : 'Support request'} from ${name}`;
  const text = `Type: ${kind}
From: ${name} <${email}>

${message}`;

  const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.GMAIL_SMTP_PORT ?? 465),
    secure: (process.env.GMAIL_SMTP_SECURE ?? 'true') === 'true',
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: process.env.SUPPORT_FROM_EMAIL ?? `"AI DJ Studio" <${smtpUser}>`,
      to,
      replyTo: email,
      subject,
      text,
    });
    return NextResponse.json({ ok: true, message: 'Message sent to support.' });
  } catch (error) {
    console.error('[/api/support]', error);
    return NextResponse.json({
      ok: false,
      message: 'Support email could not be sent. Check the Gmail SMTP env values.',
    }, { status: 502 });
  }
}
