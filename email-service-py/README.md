# FlowMind Python Mail Service 🐍

A lightweight FastAPI microservice to **send** OTP emails via SMTP and **read/receive** them via IMAP.

## 🚀 Setup & Run Instructions

### 1. Install Dependencies
Make sure you have Python 3.8+ installed. Navigate to this folder and run:
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your details:
```bash
cp .env.example .env
```

Open `.env` and enter your SMTP (and optional IMAP) settings:
```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=FlowMind Security <your_email@gmail.com>

# To read/fetch emails:
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASS=your_app_password
```

### 3. Run the Server
Start the development server using `uvicorn`:
```bash
uvicorn main:app --reload --port 8000
```
The server will start running locally at `http://127.0.0.1:8000`.

---

## 📡 API Endpoints

### 1. Send OTP Email (`POST /send-otp`)
* **URL**: `/send-otp`
* **Method**: `POST`
* **Body**:
```json
{
  "email": "recipient@example.com",
  "otp": "831070",
  "expires_at": "11:29:46 AM"
}
```

### 2. Fetch Latest OTP (`GET /fetch-otp`)
Connects to the inbox, finds the latest message sent to the recipient, extracts the 6-digit OTP code using regex, and returns it.
* **URL**: `/fetch-otp?email_address=recipient@example.com`
* **Method**: `GET`
* **Response**:
```json
{
  "success": true,
  "email": "recipient@example.com",
  "otp": "831070",
  "subject": "FlowMind Security - Verify Your Account"
}
```
