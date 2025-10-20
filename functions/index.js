// =============================
// Tatak Cloud Functions (CORS FIXED)
// =============================

require("dotenv").config();

const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
const cors = require("cors");

// --- Access Gmail credentials ---
const gmailEmail = process.env.GMAIL_EMAIL || functions.params.GMAIL_EMAIL?.value();
const gmailPassword = process.env.GMAIL_PASSWORD || functions.params.GMAIL_PASSWORD?.value();

// --- Create Gmail transporter ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

// =============================
// Helper: Create CORS middleware
// =============================
function createCorsMiddleware() {
  return cors({
    origin: ["https://tatak-mobile-web.web.app", "http://localhost:3000", "http://localhost:5001"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  });
}

// =============================
// Helper: Send email function
// =============================
async function sendEmail({ to, subject, html }) {
  const mailOptions = {
    from: `"Admin" <${gmailEmail}>`,
    to,
    subject,
    html,
  };
  await transporter.sendMail(mailOptions);
}

// =============================
// Function: sendApprovalEmail
// =============================
exports.sendApprovalEmail = onRequest((req, res) => {
  const corsMiddleware = createCorsMiddleware();
  corsMiddleware(req, res, async () => {
    // Handle preflight
    if (req.method === "OPTIONS") {
      return res.status(204).send("ok");
    }

    try {
      const { email, firstName, link } = req.body;
      if (!email || !firstName || !link) {
        return res.status(400).json({
          success: false,
          message: "Missing email, firstName, or link.",
        });
      }

      await sendEmail({
        to: email,
        subject: "Your Designee Status Has Been Approved",
        html: `
          <p>Hello ${firstName},</p>
          <p>Your account has been <b>Approved</b> by the admin.</p>
          <p>Please click the link below to log in and verify:</p>
          <a href="${link}">Login Now</a>
          <br><br>
          <p>Approval Time: ${new Date().toLocaleString()}</p>
          <p>Thank you!</p>
        `,
      });

      return res.status(200).json({ success: true, message: "Approval email sent." });
    } catch (error) {
      console.error("Error sending approval email:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send approval email.",
        error: error.message,
      });
    }
  });
});

// =============================
// Function: sendResetEmail (Designee)
// =============================
exports.sendResetEmail = onRequest((req, res) => {
  const corsMiddleware = createCorsMiddleware();
  corsMiddleware(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("ok");
    }

    try {
      const { email, firstName, link } = req.body;
      if (!email || !firstName || !link) {
        return res.status(400).json({
          success: false,
          message: "Missing email, firstName, or link.",
        });
      }

      await sendEmail({
        to: email,
        subject: "Reset Your Password",
        html: `
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password.</p>
          <p>Please click the link below to set a new password (link expires in 1 hour):</p>
          <a href="${link}">Reset Password</a>
          <br><br>
          <p>If you did not request this, please ignore this email.</p>
          <p>Thank you!</p>
        `,
      });

      return res.status(200).json({ success: true, message: "Password reset email sent." });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email.",
        error: error.message,
      });
    }
  });
});

// =============================
// Function: studentResetEmail
// =============================
exports.studentResetEmail = onRequest((req, res) => {
  const corsMiddleware = createCorsMiddleware();
  corsMiddleware(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("ok");
    }

    try {
      const { email, firstName, link } = req.body;
      if (!email || !firstName || !link) {
        return res.status(400).json({
          success: false,
          message: "Missing email, firstName, or link.",
        });
      }

      await sendEmail({
        to: email,
        subject: "Reset Your Student Account Password",
        html: `
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your student account password.</p>
          <p>Please click the link below to set a new password (link expires in 1 hour):</p>
          <a href="${link}">Reset Password</a>
          <br><br>
          <p>If you did not request this, please ignore this email.</p>
          <p>Thank you!</p>
        `,
      });

      return res.status(200).json({ success: true, message: "Student password reset email sent." });
    } catch (error) {
      console.error("Error sending student password reset email:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send student password reset email.",
        error: error.message,
      });
    }
  });
});