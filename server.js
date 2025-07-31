const express = require('express');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app`
});

const db = admin.firestore();

// Email transporter setup
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// IMAP configuration for reading emails
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: process.env.IMAP_HOST,
  port: process.env.IMAP_PORT,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

// Store pending registrations
const pendingRegistrations = new Map();

// Email monitoring function
function startEmailMonitoring() {
  const imap = new Imap(imapConfig);
  
  imap.once('ready', function() {
    console.log('IMAP connected and ready');
    
    imap.openBox('INBOX', false, function(err, box) {
      if (err) throw err;
      
      // Listen for new emails
      imap.on('mail', function(numNewMsgs) {
        console.log(`${numNewMsgs} new message(s) received`);
        checkForSignupEmails();
      });
      
      // Initial check for existing emails
      checkForSignupEmails();
    });
  });
  
  imap.once('error', function(err) {
    console.log('IMAP error:', err);
    // Reconnect after 30 seconds
    setTimeout(startEmailMonitoring, 30000);
  });
  
  imap.once('end', function() {
    console.log('IMAP connection ended');
    // Reconnect after 30 seconds
    setTimeout(startEmailMonitoring, 30000);
  });
  
  imap.connect();

  function checkForSignupEmails() {
    imap.search(['UNSEEN', ['SUBJECT', 'Signup']], function(err, results) {
      if (err) {
        console.log('Search error:', err);
        return;
      }
      
      if (results.length === 0) return;
      
      const fetch = imap.fetch(results, { bodies: '', markSeen: true });
      
      fetch.on('message', function(msg, seqno) {
        let emailData = {};
        
        msg.on('body', function(stream, info) {
          let buffer = '';
          stream.on('data', function(chunk) {
            buffer += chunk.toString('utf8');
          });
          
          stream.once('end', function() {
            emailData.body = buffer;
          });
        });
        
        msg.once('attributes', function(attrs) {
          emailData.attrs = attrs;
        });
        
        msg.once('end', function() {
          processSignupEmail(emailData);
        });
      });
    });
  }
}

// Process signup emails
async function processSignupEmail(emailData) {
  try {
    const parsed = parseEmail(emailData.body);
    const senderEmail = extractSenderEmail(emailData.attrs.envelope);
    const senderName = extractSenderName(parsed.from || emailData.attrs.envelope.from[0].name);
    
    console.log(`Processing signup for: ${senderEmail} (${senderName})`);
    
    // Check if user already exists
    const existingUser = await db.collection('users').where('email', '==', senderEmail).get();
    
    if (!existingUser.empty) {
      await sendEmailReply(senderEmail, 'Registration Status', 
        `Hello ${senderName},\n\nYou are already registered with this email address.\n\nBest regards,\nRegistration System`);
      return;
    }
    
    // Store pending registration
    const registrationId = uuidv4();
    pendingRegistrations.set(senderEmail, {
      id: registrationId,
      email: senderEmail,
      name: senderName,
      timestamp: new Date()
    });
    
    // Send password request email
    await sendPasswordRequestEmail(senderEmail, senderName);
    
  } catch (error) {
    console.error('Error processing signup email:', error);
  }
}

// Parse email content
function parseEmail(body) {
  const lines = body.split('\n');
  let from = '';
  let subject = '';
  let content = '';
  let inHeaders = true;
  
  for (const line of lines) {
    if (inHeaders) {
      if (line.startsWith('From:')) {
        from = line.substring(5).trim();
      } else if (line.startsWith('Subject:')) {
        subject = line.substring(8).trim();
      } else if (line.trim() === '') {
        inHeaders = false;
      }
    } else {
      content += line + '\n';
    }
  }
  
  return { from, subject, content: content.trim() };
}

// Extract sender email from envelope
function extractSenderEmail(envelope) {
  if (envelope && envelope.from && envelope.from.length > 0) {
    return envelope.from[0].address;
  }
  return '';
}

// Extract sender name
function extractSenderName(fromField) {
  if (!fromField) return 'User';
  
  // Extract name from "Name <email>" format
  const nameMatch = fromField.match(/^(.+?)\s*<.+>$/);
  if (nameMatch) {
    return nameMatch[1].trim().replace(/"/g, '');
  }
  
  return fromField.split('@')[0]; // Use email prefix as fallback
}

// Send password request email
async function sendPasswordRequestEmail(email, name) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Set Your Password - Registration',
    text: `Hello ${name},

Thank you for signing up! To complete your registration, please reply to this email with your desired password.

Your password should be at least 8 characters long for security.

Simply reply with your password and we'll complete your registration.

Best regards,
Registration System`
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password request sent to ${email}`);
  } catch (error) {
    console.error('Error sending password request:', error);
  }
}

// Send confirmation email
async function sendConfirmationEmail(email, name, password) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Registration Confirmed',
    text: `Hello ${name},

Congratulations! You have been successfully signed up.

Your registration details:
- Name: ${name}
- Email: ${email}
- Password: ${password}

Please keep this information secure and consider changing your password after your first login.

Welcome aboard!

Best regards,
Registration System`
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

// Send general email reply
async function sendEmailReply(email, subject, message) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    text: message
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email reply sent to ${email}`);
  } catch (error) {
    console.error('Error sending email reply:', error);
  }
}

// Enhanced email monitoring for password replies
function startPasswordMonitoring() {
  const imap = new Imap(imapConfig);
  
  imap.once('ready', function() {
    imap.openBox('INBOX', false, function(err, box) {
      if (err) throw err;
      
      imap.on('mail', function(numNewMsgs) {
        checkForPasswordReplies();
      });
      
      setInterval(checkForPasswordReplies, 30000); // Check every 30 seconds
    });
  });
  
  imap.once('error', function(err) {
    console.log('Password monitoring IMAP error:', err);
    setTimeout(startPasswordMonitoring, 30000);
  });
  
  imap.connect();

  function checkForPasswordReplies() {
    imap.search(['UNSEEN'], function(err, results) {
      if (err || results.length === 0) return;
      
      const fetch = imap.fetch(results, { bodies: '', markSeen: true });
      
      fetch.on('message', function(msg, seqno) {
        let emailData = {};
        
        msg.on('body', function(stream, info) {
          let buffer = '';
          stream.on('data', function(chunk) {
            buffer += chunk.toString('utf8');
          });
          
          stream.once('end', function() {
            emailData.body = buffer;
          });
        });
        
        msg.once('attributes', function(attrs) {
          emailData.attrs = attrs;
        });
        
        msg.once('end', function() {
          processPasswordReply(emailData);
        });
      });
    });
  }
}

// Process password reply emails
async function processPasswordReply(emailData) {
  try {
    const senderEmail = extractSenderEmail(emailData.attrs.envelope);
    const pendingReg = pendingRegistrations.get(senderEmail);
    
    if (!pendingReg) return; // Not a pending registration
    
    const parsed = parseEmail(emailData.body);
    const subject = emailData.attrs.envelope.subject || '';
    
    // Check if this is a reply to password request
    if (subject.toLowerCase().includes('set your password') || 
        subject.toLowerCase().includes('re:') ||
        subject.toLowerCase().includes('registration')) {
      
      const password = extractPasswordFromEmail(parsed.content);
      
      if (password && password.length >= 8) {
        await completeRegistration(pendingReg, password);
        pendingRegistrations.delete(senderEmail);
      } else {
        await sendEmailReply(senderEmail, 'Invalid Password', 
          `Hello ${pendingReg.name},\n\nThe password you provided is too short. Please reply with a password that is at least 8 characters long.\n\nBest regards,\nRegistration System`);
      }
    }
  } catch (error) {
    console.error('Error processing password reply:', error);
  }
}

// Extract password from email content
function extractPasswordFromEmail(content) {
  // Remove email signatures and previous email content
  const lines = content.split('\n');
  let cleanContent = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Stop at common email reply indicators
    if (trimmed.startsWith('>') || 
        trimmed.startsWith('On ') || 
        trimmed.includes('wrote:') ||
        trimmed.includes('-----Original Message-----')) {
      break;
    }
    cleanContent += trimmed + ' ';
  }
  
  // Extract potential password (assuming it's the main content)
  cleanContent = cleanContent.trim();
  
  // If content is short and contains no spaces, likely a password
  if (cleanContent.length <= 50 && !cleanContent.includes(' ')) {
    return cleanContent;
  }
  
  // Look for password patterns
  const passwordMatch = cleanContent.match(/password[:\s]*([^\s\n]+)/i);
  if (passwordMatch) {
    return passwordMatch[1];
  }
  
  // If it's a short message, treat the whole thing as password
  if (cleanContent.length <= 20) {
    return cleanContent;
  }
  
  return null;
}

// Complete user registration
async function completeRegistration(pendingReg, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      id: pendingReg.id,
      name: pendingReg.name,
      email: pendingReg.email,
      password: hashedPassword,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    };
    
    // Store in Firebase
    await db.collection('users').doc(pendingReg.id).set(userData);
    
    console.log(`User registered successfully: ${pendingReg.email}`);
    
    // Send confirmation email
    await sendConfirmationEmail(pendingReg.email, pendingReg.name, password);
    
  } catch (error) {
    console.error('Error completing registration:', error);
    await sendEmailReply(pendingReg.email, 'Registration Error', 
      `Hello ${pendingReg.name},\n\nThere was an error completing your registration. Please try again later.\n\nBest regards,\nRegistration System`);
  }
}

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Email Registration System is running',
    status: 'active',
    pendingRegistrations: pendingRegistrations.size
  });
});

app.get('/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        registeredAt: userData.registeredAt,
        status: userData.status
      });
    });
    
    res.json({ users, count: users.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/pending', (req, res) => {
  const pending = Array.from(pendingRegistrations.values());
  res.json({ pendingRegistrations: pending, count: pending.length });
});

// Test email endpoint
app.post('/test-email', async (req, res) => {
  const { to, subject, message } = req.body;
  
  try {
    await sendEmailReply(to, subject, message);
    res.json({ success: true, message: 'Test email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Start server and email monitoring
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start email monitoring after a short delay
  setTimeout(() => {
    console.log('Starting email monitoring...');
    startEmailMonitoring();
    startPasswordMonitoring();
  }, 2000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});