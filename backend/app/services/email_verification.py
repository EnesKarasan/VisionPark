"""Doğrulama kodu e-posta bildirimi.

SMTP_USER + SMTP_PASSWORD .env'de tanımlıysa Gmail SMTP üzerinden gerçek e-posta
gönderilir. Tanımlı değilse veya gönderim başarısız olursa kod yine logger'a
düşer (geliştirme için).
"""
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_PURPOSE_LABELS = {
    "signup": "Kayıt",
    "password_reset": "Şifre sıfırlama",
}

_PURPOSE_SUBJECTS = {
    "signup": "VisionPark'a Hoş Geldiniz — Doğrulama Kodunuz",
    "password_reset": "VisionPark — Şifre Sıfırlama Kodunuz",
}

_PURPOSE_HEADINGS = {
    "signup": "Hesabınızı Doğrulayın",
    "password_reset": "Şifrenizi Sıfırlayın",
}

_PURPOSE_INTROS = {
    "signup": (
        "VisionPark'a kaydolduğunuz için teşekkürler! "
        "Hesabınızı aktive etmek için aşağıdaki 6 haneli kodu uygulamaya girin."
    ),
    "password_reset": (
        "Şifrenizi sıfırlama isteğinizi aldık. "
        "İşlemi tamamlamak için aşağıdaki 6 haneli kodu uygulamaya girin."
    ),
}


def _build_html(code: str, purpose: str) -> str:
    heading = _PURPOSE_HEADINGS.get(purpose, "Doğrulama Kodunuz")
    intro = _PURPOSE_INTROS.get(purpose, "İşleminizi tamamlamak için kodu kullanın.")
    year = datetime.now().year

    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VisionPark</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <!-- Header (gradient lacivert) -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a1f33 0%,#153a5c 50%,#1e4a76 100%);padding:36px 32px;text-align:center;">
              <div style="display:inline-block;font-size:26px;font-weight:800;letter-spacing:1.5px;color:#ffffff;text-shadow:0 2px 6px rgba(0,0,0,0.25);">
                Vision<span style="color:#60a5fa;">Park</span>
              </div>
              <div style="margin-top:6px;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.6px;text-transform:uppercase;">
                Akıllı Otopark Yönetimi
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 12px;color:#0f172a;font-size:22px;font-weight:700;">{heading}</h1>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">{intro}</p>

              <!-- Kod kutucuğu -->
              <div style="background:linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%);border:2px dashed #94a3b8;border-radius:14px;padding:20px;text-align:center;margin:0 0 24px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">
                  Doğrulama Kodu
                </div>
                <div style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:38px;font-weight:800;letter-spacing:12px;color:#0f172a;line-height:1;">
                  {code}
                </div>
              </div>

              <!-- Süre uyarısı -->
              <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:0 0 16px;">
                <div style="color:#92400e;font-size:13px;line-height:1.5;">
                  <strong>⏱ 15 dakika geçerli</strong> — bu süreden sonra kod kullanılamaz, yeni kod isteyebilirsiniz.
                </div>
              </div>

              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Bu işlemi siz başlatmadıysanız e-postayı görmezden gelebilirsiniz. Hesabınız güvendedir.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
                © {year} VisionPark · Bu otomatik bir e-postadır, yanıtlamayın.
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top:18px;font-size:11px;color:#94a3b8;letter-spacing:0.4px;">
          VisionPark — Akıllı Otopark Sistemi
        </div>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_text(code: str, purpose: str) -> str:
    heading = _PURPOSE_HEADINGS.get(purpose, "Doğrulama Kodunuz")
    intro = _PURPOSE_INTROS.get(purpose, "")
    return (
        f"VisionPark — {heading}\n"
        f"{'=' * 40}\n\n"
        f"{intro}\n\n"
        f"    DOĞRULAMA KODUNUZ:  {code}\n\n"
        f"Bu kod 15 dakika boyunca geçerlidir.\n\n"
        f"Bu işlemi siz başlatmadıysanız e-postayı görmezden gelebilirsiniz.\n\n"
        f"— VisionPark · Akıllı Otopark Yönetimi"
    )


def _build_message(to_email: str, code: str, purpose: str, from_addr: str, from_name: str) -> MIMEMultipart:
    subject = _PURPOSE_SUBJECTS.get(purpose, "VisionPark — Doğrulama Kodunuz")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to_email
    msg.attach(MIMEText(_build_text(code, purpose), "plain", "utf-8"))
    msg.attach(MIMEText(_build_html(code, purpose), "html", "utf-8"))
    return msg


def _send_via_smtp(to_email: str, code: str, purpose: str) -> bool:
    settings = get_settings()
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False

    msg = _build_message(
        to_email=to_email,
        code=code,
        purpose=purpose,
        from_addr=settings.SMTP_USER,
        from_name=settings.SMTP_FROM_NAME,
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        logger.info("Doğrulama e-postası gönderildi: %s", to_email)
        return True
    except Exception:
        logger.exception("SMTP gönderim hatası (%s)", to_email)
        return False


def notify_verification_code(email: str, code: str, purpose: str) -> None:
    label = _PURPOSE_LABELS.get(purpose, purpose)
    sent = _send_via_smtp(email, code, purpose)
    if not sent:
        # SMTP yoksa veya başarısızsa: kodu log'a yaz (geliştirme/sunum yedeği)
        logger.warning("%s kodu [SMTP yok/başarısız]: %s -> %s", label, email, code)
