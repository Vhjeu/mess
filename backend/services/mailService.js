const nodemailer = require('nodemailer');
const { getMailConfig } = require('../config/env');

let transporter;
let mailConfig;

const getTransporter = () => {
    if (transporter) return { transporter, mailConfig };

    mailConfig = getMailConfig();
    transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        auth: {
            user: mailConfig.user,
            pass: mailConfig.pass
        }
    });
    return { transporter, mailConfig };
};

exports.sendEmailVerification = async (email, otp) => {
    const mailer = getTransporter();
    await mailer.transporter.sendMail({
        from: mailer.mailConfig.from,
        to: email,
        subject: 'Mã xác minh email',
        text: `Mã xác minh email của bạn là ${otp}. Mã có hiệu lực trong 10 phút.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">Xác minh email</h2>
                <p>Dùng mã dưới đây để xác minh email cho tài khoản của bạn:</p>
                <div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px 0">${otp}</div>
                <p style="color:#667085">Mã có hiệu lực trong 10 phút và chỉ dùng được một lần.</p>
            </div>
        `
    });
};

exports.sendPasswordReset = async (email, token) => {
    const mailer = getTransporter();
    const resetUrl = `${mailer.mailConfig.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await mailer.transporter.sendMail({
        from: mailer.mailConfig.from,
        to: email,
        subject: 'Khôi phục mật khẩu',
        text: `Mở liên kết sau để đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút: ${resetUrl}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">Khôi phục mật khẩu</h2>
                <p>Nhấn nút dưới đây để đặt lại mật khẩu của bạn.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#3e59d6;color:#fff;text-decoration:none;font-weight:700">
                    Đặt lại mật khẩu
                </a>
                <p style="color:#667085;margin-top:20px">Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.</p>
            </div>
        `
    });
};
