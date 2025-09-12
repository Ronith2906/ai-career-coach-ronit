# 📧 Email Setup Guide for Password Reset

## 🔧 **Configuration Required**

To enable email functionality for password reset, you need to configure email settings in your `.env` file:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## 📱 **Gmail Setup (Recommended)**

### **Step 1: Enable 2-Factor Authentication**
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to "Security" → "2-Step Verification"
3. Enable 2-factor authentication

### **Step 2: Generate App Password**
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to "Security" → "App passwords"
3. Select "Mail" and "Other (Custom name)"
4. Enter "AI Career Coach" as the name
5. Copy the generated 16-character password

### **Step 3: Update Environment Variables**
Replace `your-app-password` with the generated app password in your `.env` file.

## 🚀 **Alternative Email Providers**

### **Outlook/Hotmail**
```env
EMAIL_SERVICE=outlook
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
```

### **Yahoo**
```env
EMAIL_SERVICE=yahoo
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
```

### **Custom SMTP**
```env
EMAIL_SERVICE=custom
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587
EMAIL_USER=your-username
EMAIL_PASS=your-password
```

## ✅ **Testing**

1. **Restart your server** after updating environment variables
2. **Try "Forgot Password"** functionality
3. **Check your email** for the reset token
4. **Use the token** to reset your password

## 🔒 **Security Notes**

- **Never commit** your `.env` file to version control
- **Use app passwords** instead of regular passwords for Gmail
- **Tokens expire** after 1 hour for security
- **Check spam folder** if emails don't appear in inbox

## 🆘 **Troubleshooting**

### **Email Not Sending?**
- Check your email credentials
- Verify SMTP settings
- Check firewall/antivirus settings
- Try different email provider

### **Token Not Working?**
- Ensure token hasn't expired (1 hour limit)
- Check if you're using the correct email
- Verify token was copied correctly

## 📞 **Support**

If you continue having issues, the system will fall back to showing the reset token directly in the browser for manual use.

