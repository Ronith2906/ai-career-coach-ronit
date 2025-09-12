# OAuth Setup Guide for AI Career Coach

This guide will help you set up Google and LinkedIn OAuth authentication for your AI Career Coach application.

## Prerequisites

- Node.js installed
- Access to Google Cloud Console
- Access to LinkedIn Developer Portal
- Domain or localhost for testing

## Step 1: Google OAuth Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API and Google OAuth2 API

### 1.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3007/auth/google/callback` (for development)
   - `https://yourdomain.com/auth/google/callback` (for production)
5. Copy the Client ID and Client Secret

### 1.3 Update Configuration

Add to your `config.env` file:
```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3007/auth/google/callback
```

## Step 2: LinkedIn OAuth Setup

### 2.1 Create LinkedIn App

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Click "Create App"
3. Fill in app details and submit

### 2.2 Configure OAuth Settings

1. Go to "Auth" tab
2. Add redirect URLs:
   - `http://localhost:3007/auth/linkedin/callback` (for development)
   - `https://yourdomain.com/auth/linkedin/callback` (for production)
3. Request access to these scopes:
   - `r_liteprofile` (basic profile info)
   - `r_emailaddress` (email address)
4. Copy the Client ID and Client Secret

### 2.3 Update Configuration

Add to your `config.env` file:
```
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3007/auth/linkedin/callback
```

## Step 3: Environment Setup

### 3.1 Copy Configuration Template

```bash
cp config.env.example config.env
```

### 3.2 Fill in Your Credentials

Edit `config.env` with your actual OAuth credentials.

### 3.3 Install Dependencies

```bash
npm install
```

## Step 4: Test OAuth

### 4.1 Start the Server

```bash
node server.js
```

### 4.2 Test OAuth Flow

1. Open your application
2. Click "Continue with Gmail" or "Continue with LinkedIn"
3. Complete the OAuth flow
4. Check that you're logged in successfully

## Step 5: Production Deployment

### 5.1 Update Redirect URIs

Change all redirect URIs to your production domain:
- `https://yourdomain.com/auth/google/callback`
- `https://yourdomain.com/auth/linkedin/callback`

### 5.2 Environment Variables

Set production environment variables:
```bash
export GOOGLE_CLIENT_ID=your_production_client_id
export GOOGLE_CLIENT_SECRET=your_production_client_secret
export GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
export LINKEDIN_CLIENT_ID=your_production_client_id
export LINKEDIN_CLIENT_SECRET=your_production_client_secret
export LINKEDIN_REDIRECT_URI=https://yourdomain.com/auth/linkedin/callback
```

## Troubleshooting

### Common Issues

1. **"Popup blocked" error**
   - Allow popups for your domain
   - Check browser popup blocker settings

2. **"Invalid redirect URI" error**
   - Verify redirect URIs match exactly in OAuth console
   - Check for trailing slashes or protocol mismatches

3. **"Client ID not found" error**
   - Verify OAuth credentials are correct
   - Check that APIs are enabled in Google Cloud Console

4. **"Scope not allowed" error**
   - Request appropriate scopes in LinkedIn app settings
   - Wait for LinkedIn approval (can take 24-48 hours)

### Debug Mode

Enable debug logging by adding to your server:
```javascript
console.log('OAuth config:', OAUTH_CONFIG);
console.log('Auth URL:', generateGoogleAuthUrl());
```

## Security Considerations

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Validate OAuth state** to prevent CSRF attacks
4. **Implement proper session management**
5. **Use HTTPS in production**

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify OAuth configuration
3. Test with minimal scopes first
4. Check network tab for failed requests

## Next Steps

After OAuth is working:
1. Implement user profile management
2. Add OAuth logout functionality
3. Implement refresh token handling
4. Add user avatar/profile picture support

