const nodemailer = require('nodemailer');
const env = require('./env');
const logger = require('../utils/logger');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    });
  }
  return transporter;
};

const verifyEmailConnection = async () => {
  try {
    await getTransporter().verify();
    logger.info('✅ Email service connected');
  } catch (err) {
    logger.warn('Email service unavailable:', err.message);
  }
};

const sendEmail = async ({ to, subject, html }) => {
  await getTransporter().sendMail({ from: env.EMAIL_FROM, to, subject, html });
  logger.debug(`Email sent to ${to}: ${subject}`);
};

module.exports = { verifyEmailConnection, sendEmail };
