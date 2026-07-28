# Cấu hình gửi email

Backend cần các biến môi trường sau để gửi OTP xác minh và liên kết khôi phục mật khẩu:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="Nhắn Tin <no-reply@example.com>"
FRONTEND_URL=http://localhost:3000
EMAIL_TOKEN_SECRET=replace-with-a-long-random-secret
```

Nếu không đặt `EMAIL_TOKEN_SECRET`, backend sẽ dùng `JWT_SECRET` để tạo HMAC cho OTP và token.
