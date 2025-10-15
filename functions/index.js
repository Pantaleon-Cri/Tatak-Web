// Load environment variables from .env
require("dotenv").config();

const { onRequest } = require("firebase-functions/https");
const nodemailer = require("nodemailer");

// Gmail credentials from .env
const gmailEmail = process.env.GMAIL_EMAIL;
const gmailPassword = process.env.GMAIL_PASSWORD;

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

/**
 * HTTP function to send approval email to designee
 * Frontend will call this after admin approves a designee
 */
exports.sendApprovalEmail = onRequest(async (req, res) => {
  try {
    const { email, firstName, link } = req.body;

    if (!email || !firstName || !link) {
      return res.status(400).json({
        success: false,
        message: "Missing email, firstName, or link.",
      });
    }

    const mailOptions = {
      from: `"Admin" <${gmailEmail}>`,
      to: email,
      subject: "Your Designee Status Has Been Approved",
      html: `
        <p>Your account has been <b>Approved</b> by the admin.</p>
        <p>Please click the link below to log in and verify:</p>
        <a href="${link}">Login Now</a>
        <p>Approval Time: ${new Date().toLocaleString()}</p>
        <br>
        <p>Thank you!</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Approval email sent.",
    });
  } catch (error) {
    console.error("Error sending approval email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send approval email.",
      error: error.message,
    });
  }
});

/**
 * HTTP function to send password reset email to designee
 * Frontend will call this after user requests password reset
 */
exports.sendResetEmail = onRequest(async (req, res) => {
  try {
    const { email, firstName, link } = req.body;

    if (!email || !firstName || !link) {
      return res.status(400).json({
        success: false,
        message: "Missing email, firstName, or link.",
      });
    }

    const mailOptions = {
      from: `"Admin" <${gmailEmail}>`,
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
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Password reset email sent.",
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email.",
      error: error.message,
    });
  }
});

/**
 * HTTP function to send password reset email to students
 * Frontend will call this after a student requests password reset
 */
exports.studentResetEmail = onRequest(async (req, res) => {
  try {
    const { email, firstName, link } = req.body;

    if (!email || !firstName || !link) {
      return res.status(400).json({
        success: false,
        message: "Missing email, firstName, or link.",
      });
    }

    const mailOptions = {
      from: `"Admin" <${gmailEmail}>`,
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
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Student password reset email sent.",
    });
  } catch (error) {
    console.error("Error sending student password reset email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send student password reset email.",
      error: error.message,
    });
  }
});
