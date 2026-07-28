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

const sendOtpEmail = async ({
    email,
    otp,
    subject,
    heading,
    description
}) => {
    const mailer = getTransporter();
    await mailer.transporter.sendMail({
        from: mailer.mailConfig.from,
        to: email,
        subject,
        text: `${description} Mã của bạn là ${otp}. Mã có hiệu lực trong 10 phút.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">${heading}</h2>
                <p>${description}</p>
                <div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px 0">${otp}</div>
                <p style="color:#667085">Mã có hiệu lực trong 10 phút và chỉ dùng được một lần.</p>
            </div>
        `
    });
};

exports.sendEmailVerification = (email, otp, { isEmailChange = false } = {}) => (
    sendOtpEmail({
        email,
        otp,
        subject: isEmailChange ? 'Xác minh email mới' : 'Mã xác minh email',
        heading: isEmailChange ? 'Xác minh email mới' : 'Xác minh email',
        description: isEmailChange
            ? 'Dùng mã dưới đây để xác minh email mới cho tài khoản của bạn.'
            : 'Dùng mã dưới đây để xác minh email cho tài khoản của bạn.'
    })
);

exports.sendCurrentEmailChangeConfirmation = (email, otp) => (
    sendOtpEmail({
        email,
        otp,
        subject: 'Xác nhận yêu cầu đổi email',
        heading: 'Xác nhận email hiện tại',
        description: 'Có yêu cầu đổi email khôi phục. Dùng mã dưới đây để xác nhận bạn vẫn kiểm soát email hiện tại.'
    })
);

const sendEmailChangeNotice = async ({ email, subject, heading, description }) => {
    const mailer = getTransporter();
    await mailer.transporter.sendMail({
        from: mailer.mailConfig.from,
        to: email,
        subject,
        text: description,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">${heading}</h2>
                <p>${description}</p>
                <p style="color:#667085">Nếu bạn không thực hiện thay đổi này, hãy đổi mật khẩu tài khoản ngay lập tức.</p>
            </div>
        `
    });
};

exports.sendEmailChangedNoticeToOld = email => sendEmailChangeNotice({
    email,
    subject: 'Email khôi phục của tài khoản đã được thay đổi',
    heading: 'Email đã được thay đổi',
    description: 'Email này không còn là email khôi phục của tài khoản.'
});

exports.sendEmailChangedNoticeToNew = email => sendEmailChangeNotice({
    email,
    subject: 'Email khôi phục mới đã được xác minh',
    heading: 'Đổi email thành công',
    description: 'Email này hiện là email khôi phục đã xác minh của tài khoản.'
});

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
