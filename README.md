# 🚀 AI Career Coach - Professional Career Coaching Platform

An AI-powered career coaching application that provides personalized resume optimization, interview preparation, career planning, and job search strategies.

## ✨ Features

- **AI-Powered Chat Assistant** - Get career guidance and answer general questions
- **Resume Analysis & Optimization** - Upload resumes and get role-specific improvements
- **Cover Letter Generation** - Create personalized cover letters for specific roles
- **Interview Preparation** - Practice with AI-powered mock interviews using voice input
- **Career Development Planning** - Get personalized career roadmaps and strategies
- **Job Search Strategies** - AI-generated job hunting guidance
- **Document Upload** - Support for PDF and Word documents
- **Voice Input** - Natural conversation for chat and interview practice
- **Affordable Pricing** - Free trial + competitive subscription plans

## 🚀 Quick Start

### Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Set your OpenAI API key in environment variables
4. Run: `npm start`
5. Open: http://localhost:3006

### Heroku Deployment

1. **Install Heroku CLI**
   ```bash
   # Windows
   winget install --id=Heroku.HerokuCLI
   
   # Or download from: https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set OPENAI_API_KEY=your_actual_openai_api_key
   heroku config:set NODE_ENV=production
   ```

5. **Deploy to Heroku**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push heroku main
   ```

6. **Open Your App**
   ```bash
   heroku open
   ```

## 🔧 Environment Variables

Create a `.env` file locally or set in Heroku:

```bash
OPENAI_API_KEY=your_openai_api_key_here
PORT=3006
NODE_ENV=production
```

## 📱 Payment Plans

- **Free Trial**: 3 days with basic features
- **Starter**: $9.99/month - Enhanced features
- **Professional**: $19.99/month - Full access
- **Enterprise**: $39.99/month - Premium features

## 🛠️ Tech Stack

- **Backend**: Node.js with native HTTP module
- **AI**: OpenAI GPT-4 API
- **Frontend**: HTML5, CSS3, JavaScript
- **Document Processing**: PDF.js, docx.js
- **Voice**: Web Speech API
- **Deployment**: Heroku

## 📄 API Endpoints

- `GET /` - Main application
- `POST /api/chat` - AI chat responses
- `POST /api/resume-analysis` - Resume analysis
- `POST /api/cover-letter` - Cover letter generation
- `POST /api/interview-prep` - Interview questions
- `POST /api/career-planning` - Career development
- `POST /api/job-search` - Job search strategies
- `POST /api/update-resume` - Role-based resume optimization
- `POST /api/upload-document` - Document upload
- `GET /api/payment-plans` - Available plans
- `POST /api/process-payment` - Payment processing

## 🎯 Getting Started with Promotion

1. **Deploy to Heroku** (see steps above)
2. **Get your public URL**: `https://your-app-name.herokuapp.com`
3. **Test all features** thoroughly
4. **Share your URL** on social media, LinkedIn, career forums
5. **Create marketing materials** highlighting the free trial
6. **Gather user feedback** and iterate

## 🔒 Security Notes

- API keys are stored securely in Heroku environment variables
- CORS is configured for cross-origin requests
- Input validation and sanitization implemented
- Rate limiting recommended for production use

## 📞 Support

For technical support or feature requests, please contact the development team.

---

**Ready to launch your career coaching platform? Follow the Heroku deployment steps above and start promoting your AI Career Coach! 🚀**
