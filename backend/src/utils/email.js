const { sendEmail } = require('../config/email');
const env = require('../config/env');

const sendVerificationEmail = (email, token) => {
  const url = `${env.CLIENT_URL}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Xác thực tài khoản Football Platform',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#16a34a">⚽ Football Community Platform</h2>
        <h3>Xác thực địa chỉ email của bạn</h3>
        <p>Cảm ơn bạn đã đăng ký! Nhấn vào nút bên dưới để xác thực tài khoản.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#16a34a;
           color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Xác thực email
        </a>
        <p style="color:#666;font-size:14px">Link hết hạn sau 24 giờ.</p>
        <p style="color:#999;font-size:12px">Nếu bạn không đăng ký, hãy bỏ qua email này.</p>
      </div>`,
  });
};

const sendPasswordResetEmail = (email, token) => {
  const url = `${env.CLIENT_URL}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Đặt lại mật khẩu Football Platform',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#16a34a">⚽ Football Community Platform</h2>
        <h3>Đặt lại mật khẩu</h3>
        <p>Nhấn vào nút bên dưới để đặt lại mật khẩu của bạn.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#dc2626;
           color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Đặt lại mật khẩu
        </a>
        <p style="color:#666;font-size:14px">Link hết hạn sau 1 giờ.</p>
        <p style="color:#999;font-size:12px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>`,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
