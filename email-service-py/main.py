import os
import re
import ssl
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="FlowMind Python Mail Worker", version="1.0.0")

# Enable CORS for frontend and monorepo integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SMTP Config
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "FlowMind Security <noreply@flowmind.com>")

# IMAP Config (For reading/receiving emails)
IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASS = os.getenv("IMAP_PASS", "")

class OtpRequest(BaseModel):
    email: EmailStr
    otp: str
    expires_at: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "python-mail-worker"}

@app.post("/send-otp")
async def send_otp(payload: OtpRequest):
    """
    Sends an HTML formatted OTP verification email using SMTP.
    """
    if not SMTP_USER or not SMTP_PASS:
        raise HTTPException(status_code=500, detail="SMTP credentials are not configured in environment.")

    # HTML Email template
    html_content = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: bold; color: #6366f1;">FlowMind</span>
      </div>
      <h2 style="font-size: 18px; font-weight: bold; color: #18181b; margin-bottom: 16px;">Verify Your Account</h2>
      <p style="font-size: 14px; color: #71717a; line-height: 1.5; margin-bottom: 24px;">
        Use the verification code below to verify your FlowMind email address. This code is active for 5 minutes.
      </p>
      <div style="background-color: #f4f4f5; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #18181b;">{payload.otp}</span>
      </div>
      <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 0;">
        Expires at: {payload.expires_at}
      </p>
    </div>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = "FlowMind Security - Verify Your Account"
    message["From"] = SMTP_FROM
    message["To"] = payload.email

    # Attach both plain text and HTML versions
    plain_text = f"Your FlowMind verification code is: {payload.otp}. Expires at: {payload.expires_at}"
    message.attach(MIMEText(plain_text, "plain"))
    message.attach(MIMEText(html_content, "html"))

    try:
        # Establish secure connection
        if SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, payload.email, message.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, payload.email, message.as_string())
        
        return {"success": True, "message": f"OTP successfully sent to {payload.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@app.get("/fetch-otp")
async def fetch_latest_otp(email_address: str):
    """
    Connects to the IMAP server and retrieves the latest 6-digit OTP code sent to this email address.
    Useful for automated verification checks.
    """
    if not IMAP_USER or not IMAP_PASS:
        raise HTTPException(status_code=500, detail="IMAP credentials are not configured in environment.")

    try:
        # Connect to IMAP
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(IMAP_USER, IMAP_PASS)
        mail.select("inbox")

        # Search for messages matching the sender or recipient
        status, messages = mail.search(None, f'(TO "{email_address}")')
        if status != "OK" or not messages[0]:
            mail.logout()
            return {"success": False, "message": "No emails found for this address."}

        # Fetch the latest message
        mail_ids = messages[0].split()
        latest_id = mail_ids[-1]
        
        status, data = mail.fetch(latest_id, "(RFC822)")
        if status != "OK":
            mail.logout()
            return {"success": False, "message": "Failed to fetch email content."}

        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)

        # Extract text body
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode()
                    break
        else:
            body = msg.get_payload(decode=True).decode()

        mail.logout()

        # Regex search for 6-digit OTP code
        otp_match = re.search(r'\b\d{6}\b', body)
        if otp_match:
            return {
                "success": True,
                "email": email_address,
                "otp": otp_match.group(0),
                "subject": msg["subject"]
            }
        
        return {"success": False, "message": "Email found, but no 6-digit verification code could be parsed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IMAP connection failed: {str(e)}")
