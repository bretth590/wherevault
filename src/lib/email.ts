import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@wherevault.app";
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; color: #888; font-size: 13px; }
    p { color: #333; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">WhereVault</div>
    ${content}
    <div class="footer">
      <p>This email was sent by WhereVault. If you did not expect this, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    return;
  }
  await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
  const html = baseLayout(`
    <h2 style="color:#1a1a1a;">Verify your email</h2>
    <p>Welcome to WhereVault! Please verify your email address to get started.</p>
    <p><a class="btn" href="${verifyUrl}">Verify Email</a></p>
    <p style="font-size:13px;color:#888;">Or copy this link: ${verifyUrl}</p>
  `);
  await sendEmail(to, "Verify your WhereVault email", html);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
  const html = baseLayout(`
    <h2 style="color:#1a1a1a;">Reset your password</h2>
    <p>We received a request to reset your WhereVault password. Click below to choose a new one.</p>
    <p><a class="btn" href="${resetUrl}">Reset Password</a></p>
    <p style="font-size:13px;color:#888;">Or copy this link: ${resetUrl}</p>
    <p>This link expires in 1 hour. If you didn't request this, no action is needed.</p>
  `);
  await sendEmail(to, "Reset your WhereVault password", html);
}

export async function sendTrusteeInviteEmail(
  to: string,
  grantorName: string,
  role: string,
  inviteToken: string,
): Promise<void> {
  const acceptUrl = `${FRONTEND_URL}/invite/${inviteToken}`;
  const roleLabel = role === "EXECUTOR" ? "executor" : "trustee";
  const html = baseLayout(`
    <h2 style="color:#1a1a1a;">You've been invited as a ${roleLabel}</h2>
    <p><strong>${grantorName}</strong> has designated you as a ${roleLabel} for their WhereVault digital vault.</p>
    <p>As a ${roleLabel}, you may be granted access to their vault items under certain conditions they've configured.</p>
    <p><a class="btn" href="${acceptUrl}">Accept Invitation</a></p>
    <p style="font-size:13px;color:#888;">Or copy this link: ${acceptUrl}</p>
    <p>This invitation expires in 7 days.</p>
  `);
  await sendEmail(to, `${grantorName} invited you as a ${roleLabel} on WhereVault`, html);
}

export async function sendDeadManSwitchWarning(
  to: string,
  userName: string,
  daysOverdue: number,
): Promise<void> {
  const url = `${FRONTEND_URL}/vault/inheritance?tab=triggers`;
  const html = baseLayout(`
    <h2 style="color:#c0392b;">Check-in required</h2>
    <p>Hi ${userName},</p>
    <p>Your WhereVault dead man switch has detected that you haven't checked in for <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong> past your scheduled interval.</p>
    <p>If you do not check in soon, your trustees will be granted access to your vault according to your configured settings.</p>
    <p><a class="btn" href="${url}" style="background:#c0392b;">Check In Now</a></p>
    <p style="font-size:13px;color:#888;">If you are unable to check in, your vault will be transferred to your designated trustees.</p>
  `);
  await sendEmail(to, "WhereVault: Urgent check-in required", html);
}
