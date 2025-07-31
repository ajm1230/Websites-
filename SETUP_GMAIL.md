# Gmail Setup Guide for Email Registration System

This guide will help you set up the email registration system using your Gmail account.

## Prerequisites

- A Gmail account
- Node.js installed on your system
- Firebase project set up

## Step 1: Enable Gmail App Password

**IMPORTANT:** You cannot use your regular Gmail password. You MUST create an App Password.

### Enable 2-Step Verification (if not already enabled)
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on "2-Step Verification"
3. Follow the setup process to enable 2-Step Verification

### Generate App Password
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" from the dropdown
3. Select your device or enter a custom name
4. Click "Generate"
5. Copy the 16-character password (format: `abcd efgh ijkl mnop`)

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your details:
   ```env
   # Your Gmail address
   EMAIL_USER=your-email@gmail.com
   
   # Your Gmail App Password (from Step 1)
   EMAIL_PASS=abcd efgh ijkl mnop
   
   # Firebase configuration (get from Firebase Console)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   
   # Optional customization
   FROM_NAME=Your Registration System
   ```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start the System

```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

## How It Works

1. **Email Reception**: Someone sends an email to your Gmail with subject "Signup"
2. **Registration Start**: System extracts their email and name, stores as pending registration
3. **Password Request**: System sends them a reply asking for their password
4. **Password Setting**: User replies with their desired password
5. **Registration Complete**: System stores user data in Firebase and sends confirmation

## Testing the System

### Test 1: Send a Signup Email
Send an email to your configured Gmail address with:
- **Subject**: `Signup`
- **From**: Any email address
- **Body**: Can contain any text

### Test 2: Reply with Password
When you receive the password request email, reply with:
- **Body**: Your desired password (minimum 8 characters)

### Test 3: Check Registration
- Visit `http://localhost:3000/users` to see registered users
- Visit `http://localhost:3000/pending` to see pending registrations

## API Endpoints

- `GET /` - System status
- `GET /users` - List all registered users
- `GET /pending` - List pending registrations
- `POST /test-email` - Send test email

## Troubleshooting

### Common Issues

1. **"Invalid login" error**
   - Make sure you're using App Password, not regular password
   - Verify 2-Step Verification is enabled

2. **IMAP connection failed**
   - Check that IMAP is enabled in Gmail settings
   - Go to Gmail Settings > Forwarding and POP/IMAP > Enable IMAP

3. **Emails not being detected**
   - Check the subject line is exactly "Signup"
   - Verify the email monitoring logs in console

4. **Firebase errors**
   - Ensure Firebase service account key is properly formatted
   - Check that Firestore is enabled in your Firebase project

### Enable Gmail IMAP
1. Go to [Gmail Settings](https://mail.google.com/mail/u/0/#settings/fwdandpop)
2. Click on "Forwarding and POP/IMAP" tab
3. Under "IMAP Access", select "Enable IMAP"
4. Save changes

## Security Notes

- Never commit your `.env` file to version control
- Store your App Password securely
- Consider using environment variables in production
- The system stores passwords as hashed values in Firebase

## Example Email Flow

1. **User sends signup email:**
   ```
   To: your-email@gmail.com
   Subject: Signup
   From: newuser@example.com
   Body: Hi, I'd like to sign up!
   ```

2. **System responds:**
   ```
   From: Your Registration System <your-email@gmail.com>
   To: newuser@example.com
   Subject: Set Your Password - Registration
   Body: Hello User, please reply with your desired password...
   ```

3. **User replies with password:**
   ```
   To: your-email@gmail.com
   Subject: Re: Set Your Password - Registration
   Body: mySecurePassword123
   ```

4. **System confirms registration:**
   ```
   From: Your Registration System <your-email@gmail.com>
   To: newuser@example.com
   Subject: Registration Confirmed ✅
   Body: Congratulations! Your details: Name: User, Email: newuser@example.com, Password: mySecurePassword123
   ```

Your email registration system is now ready to use!