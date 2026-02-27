/**
 * Email Service - Nodemailer SMTP Client
 *
 * Sends verification emails via Hostinger SMTP (info@owlivion.com)
 */

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send 6-digit verification code email
 */
export async function sendVerificationCode(email, code) {
  const from = process.env.SMTP_FROM || 'Owlivion Mail <info@owlivion.com>';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0a0a12; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a12; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background-color:#13132b; border-radius:16px; overflow:hidden; border:1px solid #2a2a4a;">
          <!-- Gradient Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #6d28d9 100%); padding:36px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:800; letter-spacing:-0.5px;">Owlivion Mail</h1>
              <p style="margin:10px 0 0; color:rgba(255,255,255,0.85); font-size:15px; font-weight:500;">E-posta Do\u011frulama</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="color:#e5e7eb; font-size:16px; line-height:1.7; margin:0 0 28px;">
                Merhaba,<br><br>
                Owlivion Mail hesab\u0131n\u0131z\u0131 do\u011frulamak i\u00e7in a\u015fa\u011f\u0131daki 6 haneli kodu kullan\u0131n:
              </p>
              <!-- Code Box -->
              <div style="background:linear-gradient(135deg, #1a1a3e 0%, #0f0f20 100%); border:2px solid #a78bfa; border-radius:12px; padding:28px 20px; text-align:center; margin:0 0 28px;">
                <span style="color:#c4b5fd; font-size:42px; font-weight:800; letter-spacing:12px; font-family:'Courier New',monospace;">${code}</span>
              </div>
              <p style="color:#9ca3af; font-size:14px; line-height:1.6; margin:0 0 10px;">
                \u23f0 Bu kodun s\u00fcresi <strong style="color:#e5e7eb;">15 dakika</strong> i\u00e7inde dolacakt\u0131r.
              </p>
              <!-- Security Warning -->
              <div style="background-color:#1c1c2e; border-left:3px solid #f59e0b; border-radius:0 8px 8px 0; padding:14px 16px; margin:20px 0 0;">
                <p style="color:#fbbf24; font-size:13px; font-weight:600; margin:0 0 6px;">
                  \ud83d\udd12 G\u00fcvenlik Uyar\u0131s\u0131
                </p>
                <p style="color:#9ca3af; font-size:13px; line-height:1.5; margin:0;">
                  Bu kodu kimseyle payla\u015fmay\u0131n. Owlivion ekibi sizden asla do\u011frulama kodu istemez. Bu istegi siz yapmad\u0131ysan\u0131z, bu e-postay\u0131 g\u00f6z ard\u0131 edebilirsiniz.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #2a2a4a; text-align:center;">
              <p style="color:#6b7280; font-size:12px; margin:0 0 8px;">
                &copy; ${new Date().getFullYear()} Owlivion Mail &mdash; G\u00fcvenli E-posta \u0130stemcisi
              </p>
              <a href="https://owlivion.com" style="color:#a78bfa; font-size:12px; text-decoration:none;">owlivion.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to: email,
    subject: `Owlivion Mail - Dogrulama Kodu: ${code}`,
    html,
  });
}

/**
 * Send welcome email on Pro signup
 */
export async function sendProWelcomeEmail(email, plan, licenseKey) {
  const from = process.env.SMTP_FROM || 'Owlivion Mail <info@owlivion.com>';
  const planLabel = plan === 'team' ? 'Takim' : 'Pro';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0a0a12; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a12; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background-color:#13132b; border-radius:16px; overflow:hidden; border:1px solid #2a2a4a;">
          <tr>
            <td style="background:linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #6d28d9 100%); padding:36px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:800; letter-spacing:-0.5px;">Owlivion Mail</h1>
              <p style="margin:10px 0 0; color:rgba(255,255,255,0.85); font-size:15px; font-weight:500;">${planLabel} Plan Aktivasyonu</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="color:#e5e7eb; font-size:16px; line-height:1.7; margin:0 0 20px;">
                Merhaba,<br><br>
                Owlivion Mail <strong style="color:#c4b5fd;">${planLabel}</strong> planina hosgeldiniz! Artik tum premium ozelliklere erisiniz var.
              </p>
              <div style="background:linear-gradient(135deg, #1a1a3e 0%, #0f0f20 100%); border:2px solid #a78bfa; border-radius:12px; padding:20px; margin:0 0 24px;">
                <p style="color:#9ca3af; font-size:13px; margin:0 0 8px;">Lisans Anahtariniz:</p>
                <span style="color:#c4b5fd; font-size:20px; font-weight:700; letter-spacing:4px; font-family:'Courier New',monospace;">${licenseKey}</span>
              </div>
              <h3 style="color:#e5e7eb; font-size:15px; font-weight:600; margin:0 0 12px;">${planLabel} Ozellikleriniz:</h3>
              <ul style="color:#9ca3af; font-size:14px; line-height:2; padding-left:20px; margin:0 0 24px;">
                <li>Sinirsiz e-posta hesabi</li>
                <li>AI akilli siralama</li>
                <li>E-posta erteleme (snooze)</li>
                <li>Zamanlanmis gonderim</li>
                <li>Takma adi yonetimi</li>
                <li>Oncelikli destek</li>
                ${plan === 'team' ? '<li>Paylasimli gelen kutusu</li><li>Denetim kayitlari</li><li>Yonetici paneli</li>' : ''}
              </ul>
              <p style="color:#9ca3af; font-size:14px; line-height:1.6; margin:0;">
                Lisansinizi aktif etmek icin: <strong style="color:#e5e7eb;">Ayarlar &gt; Plan &amp; Lisans</strong> sayfasindan anahtarinizi girin.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #2a2a4a; text-align:center;">
              <p style="color:#6b7280; font-size:12px; margin:0 0 8px;">
                &copy; ${new Date().getFullYear()} Owlivion Mail &mdash; Guvenli E-posta Istemcisi
              </p>
              <a href="https://owlivion.com" style="color:#a78bfa; font-size:12px; text-decoration:none;">owlivion.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to: email,
    subject: `Owlivion Mail ${planLabel} - Hosgeldiniz!`,
    html,
  });
}

/**
 * Send changelog/announcement email
 */
export async function sendChangelogEmail(email, version, changes) {
  const from = process.env.SMTP_FROM || 'Owlivion Mail <info@owlivion.com>';

  const changesHtml = changes
    .map((c) => `<li style="margin-bottom:8px;">${c}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0a0a12; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a12; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background-color:#13132b; border-radius:16px; overflow:hidden; border:1px solid #2a2a4a;">
          <tr>
            <td style="background:linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #6d28d9 100%); padding:36px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:800; letter-spacing:-0.5px;">Owlivion Mail</h1>
              <p style="margin:10px 0 0; color:rgba(255,255,255,0.85); font-size:15px; font-weight:500;">v${version} Yayinlandi!</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="color:#e5e7eb; font-size:16px; line-height:1.7; margin:0 0 24px;">
                Merhaba,<br><br>
                Owlivion Mail <strong style="color:#c4b5fd;">v${version}</strong> sik sik kullanima sunuldu. Bu surumde neler yeni:
              </p>
              <div style="background-color:#1a1a3e; border-radius:12px; padding:20px; margin:0 0 24px;">
                <ul style="color:#d1d5db; font-size:14px; line-height:1.8; padding-left:20px; margin:0;">
                  ${changesHtml}
                </ul>
              </div>
              <div style="text-align:center; margin:28px 0 0;">
                <a href="https://github.com/babafpv/owlivion-mail/releases/tag/v${version}"
                   style="display:inline-block; background:linear-gradient(135deg, #7c3aed, #6d28d9); color:#fff; padding:14px 32px; border-radius:10px; text-decoration:none; font-size:15px; font-weight:600;">
                  Guncelle
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #2a2a4a; text-align:center;">
              <p style="color:#6b7280; font-size:12px; margin:0 0 8px;">
                &copy; ${new Date().getFullYear()} Owlivion Mail
              </p>
              <p style="color:#4b5563; font-size:11px; margin:0;">
                Bu e-postayi almak istemiyorsaniz, Ayarlar &gt; Bildirimler boluomundan iptal edebilirsiniz.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to: email,
    subject: `Owlivion Mail v${version} - Yenilikler`,
    html,
  });
}

export default { sendVerificationCode, sendProWelcomeEmail, sendChangelogEmail };
