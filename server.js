require('dotenv').config();
const Imap = require('imap');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class EmailSignupSystem {
    constructor() {
        this.users = this.loadUsers();
        this.pendingSignups = new Map(); // Stores users waiting to set password
        this.setupIMAP();
        this.setupSMTP();
        this.startEmailMonitoring();
    }

    // Load existing users from JSON file
    loadUsers() {
        try {
            const usersFile = path.join(__dirname, 'users.json');
            if (fs.existsSync(usersFile)) {
                return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
        return [];
    }

    // Save users to JSON file
    saveUsers() {
        try {
            const usersFile = path.join(__dirname, 'users.json');
            fs.writeFileSync(usersFile, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    // Setup IMAP connection for monitoring emails
    setupIMAP() {
        this.imap = new Imap({
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASSWORD,
            host: process.env.IMAP_HOST,
            port: process.env.IMAP_PORT,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        this.imap.once('ready', () => {
            console.log('IMAP connection ready');
            this.openInbox();
        });

        this.imap.once('error', (err) => {
            console.error('IMAP connection error:', err);
        });

        this.imap.once('end', () => {
            console.log('IMAP connection ended');
            // Reconnect after a delay
            setTimeout(() => this.startEmailMonitoring(), 5000);
        });
    }

    // Setup SMTP transporter for sending emails
    setupSMTP() {
        this.transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }

    // Start monitoring emails
    startEmailMonitoring() {
        this.imap.connect();
    }

    // Open inbox and monitor for new emails
    openInbox() {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                return;
            }

            console.log('Monitoring inbox for signup emails...');

            // Listen for new emails
            this.imap.on('mail', (numNewMsgs) => {
                console.log(`${numNewMsgs} new email(s) received`);
                this.processNewEmails();
            });

            // Process existing unread emails
            this.processNewEmails();
        });
    }

    // Process new emails in inbox
    processNewEmails() {
        this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('Error searching emails:', err);
                return;
            }

            if (results.length === 0) {
                return;
            }

            const fetch = this.imap.fetch(results, { bodies: '', markSeen: true });

            fetch.on('message', (msg, seqno) => {
                let emailData = {};

                msg.on('body', (stream, info) => {
                    let buffer = '';
                    stream.on('data', (chunk) => {
                        buffer += chunk.toString('utf8');
                    });
                    stream.once('end', () => {
                        emailData.body = buffer;
                    });
                });

                msg.once('attributes', (attrs) => {
                    emailData.attrs = attrs;
                });

                msg.once('end', () => {
                    this.handleEmail(emailData);
                });
            });

            fetch.once('error', (err) => {
                console.error('Fetch error:', err);
            });
        });
    }

    // Handle individual email
    handleEmail(emailData) {
        try {
            const headers = this.parseHeaders(emailData.body);
            const subject = headers.subject || '';
            const from = headers.from || '';
            const body = this.extractEmailBody(emailData.body);

            console.log(`Processing email from: ${from}, Subject: ${subject}`);

            // Check if this is a signup email
            if (subject.toLowerCase().includes('signup')) {
                this.handleSignupEmail(from, body, headers);
            } else if (this.pendingSignups.has(from)) {
                // This might be a password response
                this.handlePasswordResponse(from, body);
            }
        } catch (error) {
            console.error('Error handling email:', error);
        }
    }

    // Parse email headers
    parseHeaders(emailBody) {
        const headers = {};
        const lines = emailBody.split('\n');
        
        for (const line of lines) {
            if (line.includes(':') && !line.startsWith(' ') && !line.startsWith('\t')) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                headers[key.toLowerCase().trim()] = value;
            }
        }
        
        return headers;
    }

    // Extract email body content
    extractEmailBody(emailBody) {
        const lines = emailBody.split('\n');
        let bodyStarted = false;
        let body = [];

        for (const line of lines) {
            if (bodyStarted) {
                body.push(line);
            } else if (line.trim() === '') {
                bodyStarted = true;
            }
        }

        return body.join('\n').trim();
    }

    // Handle signup email
    handleSignupEmail(email, body, headers) {
        console.log(`Processing signup request from: ${email}`);

        // Extract name from email or body
        const name = this.extractNameFromEmail(email, body, headers);

        // Check if user already exists
        const existingUser = this.users.find(user => user.email === email);
        if (existingUser) {
            this.sendEmail(email, 'Already Registered', 
                `Hello ${existingUser.name},\n\nYou are already registered with us.\n\nYour details:\nEmail: ${existingUser.email}\nName: ${existingUser.name}\n\nIf you forgot your password, please reply with "Reset Password"`);
            return;
        }

        // Store pending signup
        const signupId = uuidv4();
        this.pendingSignups.set(email, {
            id: signupId,
            email: email,
            name: name,
            timestamp: new Date()
        });

        // Send password request email
        this.sendPasswordRequestEmail(email, name);
    }

    // Extract name from email or content
    extractNameFromEmail(email, body, headers) {
        // Try to get name from display name in from header
        const fromHeader = headers.from || '';
        const nameMatch = fromHeader.match(/^(.+?)\s*<.+>$/);
        if (nameMatch) {
            return nameMatch[1].trim().replace(/"/g, '');
        }

        // Try to extract from email body
        const bodyLines = body.toLowerCase().split('\n');
        for (const line of bodyLines) {
            if (line.includes('name:') || line.includes('my name is')) {
                const nameFromBody = line.replace(/.*name.*?:?\s*/i, '').trim();
                if (nameFromBody && nameFromBody.length > 0) {
                    return nameFromBody;
                }
            }
        }

        // Fallback: use email username
        return email.split('@')[0];
    }

    // Send password request email
    sendPasswordRequestEmail(email, name) {
        const subject = 'Set Your Password - Registration';
        const message = `Hello ${name},

Thank you for signing up! To complete your registration, please reply to this email with your desired password.

Simply reply with your password in the following format:
Password: [your-password-here]

Or just type your password in the reply.

We'll send you a confirmation once your account is set up.

Best regards,
Registration System`;

        this.sendEmail(email, subject, message);
    }

    // Handle password response
    handlePasswordResponse(email, body) {
        const pendingSignup = this.pendingSignups.get(email);
        if (!pendingSignup) {
            return;
        }

        // Extract password from response
        const password = this.extractPassword(body);
        if (!password) {
            this.sendEmail(email, 'Password Required', 
                `Hello ${pendingSignup.name},\n\nWe couldn't find a valid password in your email. Please reply with your desired password.\n\nYou can format it as:\nPassword: [your-password]\n\nOr simply type your password in the reply.`);
            return;
        }

        // Create user account
        const newUser = {
            id: pendingSignup.id,
            email: email,
            name: pendingSignup.name,
            password: password,
            registeredAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers();
        this.pendingSignups.delete(email);

        // Send confirmation email
        this.sendConfirmationEmail(newUser);

        console.log(`User registered successfully: ${email}`);
    }

    // Extract password from email body
    extractPassword(body) {
        const lines = body.split('\n');
        
        // Look for password in various formats
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Format: "Password: something"
            if (trimmedLine.toLowerCase().startsWith('password:')) {
                const password = trimmedLine.substring(9).trim();
                if (password.length > 0) return password;
            }
            
            // Format: "my password is something"
            if (trimmedLine.toLowerCase().includes('password is')) {
                const password = trimmedLine.replace(/.*password is\s*/i, '').trim();
                if (password.length > 0) return password;
            }
        }

        // If no specific format found, use the first non-empty line that's not quoted text
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.length > 3 && 
                !trimmedLine.startsWith('>') && 
                !trimmedLine.toLowerCase().includes('wrote:') &&
                !trimmedLine.toLowerCase().includes('original message') &&
                !trimmedLine.includes('-----')) {
                return trimmedLine;
            }
        }

        return null;
    }

    // Send confirmation email
    sendConfirmationEmail(user) {
        const subject = 'Registration Successful - Welcome!';
        const message = `Hello ${user.name},

Congratulations! You have been successfully signed up.

Your account details:
• Email: ${user.email}
• Name: ${user.name}
• Password: ${user.password}
• Registration Date: ${new Date(user.registeredAt).toLocaleString()}

Please keep this information safe. You can now use these credentials to access our services.

Welcome aboard!

Best regards,
Registration System`;

        this.sendEmail(user.email, subject, message);
    }

    // Send email using SMTP
    async sendEmail(to, subject, text) {
        try {
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: to,
                subject: subject,
                text: text
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`Email sent to ${to}: ${info.messageId}`);
        } catch (error) {
            console.error(`Error sending email to ${to}:`, error);
        }
    }

    // Get all users (for API endpoint)
    getUsers() {
        return this.users.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            registeredAt: user.registeredAt
        }));
    }

    // Get pending signups (for monitoring)
    getPendingSignups() {
        return Array.from(this.pendingSignups.entries()).map(([email, data]) => ({
            email,
            name: data.name,
            timestamp: data.timestamp
        }));
    }
}

// Initialize the email signup system
const emailSystem = new EmailSignupSystem();

// Optional: Create a simple web interface for monitoring
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// API endpoints
app.get('/api/users', (req, res) => {
    res.json(emailSystem.getUsers());
});

app.get('/api/pending', (req, res) => {
    res.json(emailSystem.getPendingSignups());
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        totalUsers: emailSystem.users.length,
        pendingSignups: emailSystem.pendingSignups.size,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Email signup system running on port ${PORT}`);
    console.log(`Monitoring email: ${process.env.IMAP_USER}`);
    console.log('Send emails with subject "Signup" to register users');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down email signup system...');
    if (emailSystem.imap) {
        emailSystem.imap.end();
    }
    process.exit(0);
});