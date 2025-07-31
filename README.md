# Email-Based User Registration System

An automated email registration system that monitors an email inbox for signup requests, guides users through password setup, and stores user data securely.

## Features

- **Automated Email Monitoring**: Monitors inbox for emails with "Signup" in the subject
- **Two-Step Registration**: Users signup via email, then set password in reply
- **Name Extraction**: Automatically extracts user names from email display names or content
- **Duplicate Prevention**: Prevents duplicate registrations
- **Confirmation Emails**: Sends confirmation with complete account details
- **Web Dashboard**: Real-time monitoring dashboard for administrators
- **JSON Storage**: Simple file-based user data storage
- **API Endpoints**: RESTful API for integration

## How It Works

1. **User sends signup email** with subject containing "Signup"
2. **System extracts user info** (email, name) and stores as pending
3. **Password request sent** to user asking them to reply with desired password
4. **User replies with password** in specified format
5. **Account created** and confirmation email sent with all details
6. **Data stored** in JSON file for persistence

## Email Flow Example

### Step 1: User Signup Email
```
To: your-monitored-email@gmail.com
Subject: Signup Request
Body: Hi, my name is John Doe. Please register me for your service.
```

### Step 2: System Response
```
From: your-monitored-email@gmail.com
To: user@example.com
Subject: Set Your Password - Registration

Hello John Doe,

Thank you for signing up! To complete your registration, please reply to this email with your desired password.

Simply reply with your password in the following format:
Password: [your-password-here]

Or just type your password in the reply.
```

### Step 3: User Password Reply
```
To: your-monitored-email@gmail.com
Subject: Re: Set Your Password - Registration
Body: Password: mySecurePassword123
```

### Step 4: System Confirmation
```
From: your-monitored-email@gmail.com
To: user@example.com
Subject: Registration Successful - Welcome!

Hello John Doe,

Congratulations! You have been successfully signed up.

Your account details:
• Email: user@example.com
• Name: John Doe
• Password: mySecurePassword123
• Registration Date: 12/15/2024, 10:30:00 AM
```

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- Gmail account with App Password enabled
- IMAP and SMTP access to email account

### Setup Steps

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure email settings**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your email credentials:
   ```env
   # Email Account Settings (for receiving signup emails)
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   IMAP_USER=your-email@gmail.com
   IMAP_PASSWORD=your-app-password

   # SMTP Settings (for sending confirmation emails)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password

   # Server Settings
   PORT=3000
   ```

4. **Start the system**
   ```bash
   npm start
   ```

5. **Access the dashboard**
   Open http://localhost:3000 in your browser

## Gmail Setup

### Enable App Passwords

1. Go to Google Account settings
2. Enable 2-Factor Authentication
3. Generate App Password for "Mail"
4. Use the generated 16-character password in your `.env` file

### IMAP/SMTP Settings

For Gmail, use these settings:
- **IMAP Host**: imap.gmail.com
- **IMAP Port**: 993
- **SMTP Host**: smtp.gmail.com
- **SMTP Port**: 587

## API Endpoints

The system provides REST API endpoints for integration:

### GET /api/status
Returns system status and statistics
```json
{
  "status": "running",
  "totalUsers": 15,
  "pendingSignups": 2,
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

### GET /api/users
Returns list of registered users (passwords excluded)
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "registeredAt": "2024-12-15T10:30:00.000Z"
  }
]
```

### GET /api/pending
Returns list of pending signups waiting for password
```json
[
  {
    "email": "pending@example.com",
    "name": "Jane Smith",
    "timestamp": "2024-12-15T10:25:00.000Z"
  }
]
```

## File Structure

```
email-signup-system/
├── server.js              # Main application server
├── package.json            # Dependencies and scripts
├── .env.example           # Environment configuration template
├── .env                   # Your actual environment config (gitignored)
├── users.json             # User data storage (created automatically)
├── public/
│   └── index.html         # Web dashboard
└── README.md              # This file
```

## Data Storage

User data is stored in `users.json` with the following structure:

```json
[
  {
    "id": "unique-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "password": "userSetPassword",
    "registeredAt": "2024-12-15T10:30:00.000Z"
  }
]
```

## Security Considerations

- **Passwords stored in plain text**: For production use, implement password hashing
- **Email credentials**: Keep `.env` file secure and never commit to version control
- **HTTPS**: Use HTTPS in production for web dashboard
- **Access control**: Add authentication to admin dashboard for production

## Supported Email Formats

### Signup Email Subjects
Any subject containing "signup" (case-insensitive):
- "Signup Request"
- "Please signup me"
- "User Signup"
- "New Signup"

### Name Extraction
Names are extracted from:
1. Email display name: `"John Doe" <john@example.com>`
2. Email body containing "name:" or "my name is"
3. Fallback: username part of email address

### Password Formats
Passwords can be provided as:
- `Password: yourpassword`
- `My password is yourpassword`
- Any non-quoted line in the reply

## Troubleshooting

### Common Issues

**IMAP Connection Failed**
- Verify email credentials in `.env`
- Enable "Less secure app access" or use App Password
- Check firewall settings

**Emails Not Being Processed**
- Check email is unread in inbox
- Verify subject contains "signup"
- Check server console for error messages

**SMTP Sending Failed**
- Verify SMTP credentials
- Check email provider's SMTP settings
- Ensure 2FA is configured if using Gmail

### Logs and Monitoring

The system logs all activities to console:
- Email processing events
- User registration confirmations
- Error messages
- Connection status

## Development

### Running in Development Mode
```bash
npm run dev
```

Uses nodemon for automatic restarts on file changes.

### Adding Features

The modular design allows easy extension:
- Add new email processors in `handleEmail()`
- Extend user data structure in `users.json`
- Add new API endpoints
- Customize email templates

## License

MIT License - feel free to modify and use for your projects.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review console logs for error messages
3. Verify email configuration settings
4. Test with a simple signup email first

---

**Note**: This system is designed for small to medium scale use. For large-scale production use, consider implementing proper database storage, password hashing, rate limiting, and comprehensive error handling.