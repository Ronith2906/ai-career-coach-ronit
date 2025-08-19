# Ron's AI Career Coach - Your Personal Career Assistant

An intelligent AI-powered career coaching application that helps users with resume analysis, cover letter generation, interview preparation, and career development planning.

## 🚀 Features

### 📊 Resume Analysis & Optimization
- **Smart Resume Analysis**: AI-powered analysis comparing your resume with job descriptions
- **Alignment Scoring**: Get a 1-10 score showing how well your resume matches job requirements
- **Key Strengths Identification**: Discover what makes you stand out
- **Improvement Areas**: Get specific recommendations for enhancement
- **ATS Optimization**: Ensure your resume passes Applicant Tracking Systems

### 📄 Resume & Cover Letter Generation
- **Tailored Resume Updates**: Modify your existing resume based on job requirements
- **Custom Cover Letters**: Generate compelling cover letters for specific positions
- **Multiple Formats**: Download in Word (.docx) or PDF format
- **Professional Templates**: Industry-standard formatting and structure

### 🎯 Interactive Interview Practice
- **Question-by-Question Practice**: Realistic interview simulation
- **Comprehensive Feedback**: End-of-session performance evaluation
- **Multiple Question Types**: Behavioral, technical, and situational questions
- **Development Areas**: Identify strengths and areas for improvement

### 💬 AI Career Chat
- **Personalized Advice**: Get career guidance tailored to your situation
- **Voice Input Support**: Speak your questions naturally
- **Smart Memory**: Context-aware responses based on conversation history
- **Real-time Insights**: Instant career advice and recommendations

### 🔍 Job Search & Analytics
- **Intelligent Job Search**: Find relevant opportunities based on your profile
- **Market Analytics**: Get insights into salary trends and demand
- **Career Development Plans**: Personalized roadmap for professional growth
- **Industry Insights**: Stay updated with market trends

### 🎤 Cross-Platform Voice Support
- **Desktop & Mobile**: Works seamlessly across all devices
- **Multi-Browser Support**: Chrome, Firefox, Safari, Edge compatibility
- **Smart Fallbacks**: Graceful degradation when voice isn't available
- **Permission Management**: Handles microphone access requests

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **AI Integration**: OpenAI GPT-4 API
- **Document Processing**: PDF parsing, Word document support
- **Voice Recognition**: Web Speech API with cross-platform fallbacks
- **Styling**: Modern CSS with responsive design

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key
- Modern web browser with JavaScript enabled

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ai-career-coach.git
cd ai-career-coach
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Start the Application
```bash
npm start
```

The application will be available at `http://localhost:3006`

## 🌐 Deployment

### Heroku Deployment

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
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
   heroku config:set OPENAI_API_KEY=your_openai_api_key_here
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **Open Your App**
   ```bash
   heroku open
   ```

### Environment Variables for Production
- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Port number (Heroku sets this automatically)
- `NODE_ENV`: Set to 'production' for production deployments

## 📱 Mobile Optimization

- **Responsive Design**: Optimized for all screen sizes
- **Touch-Friendly**: Mobile-optimized interface elements
- **Voice Input**: Enhanced mobile voice recognition
- **Progressive Web App**: Works offline and can be installed

## �� Security Features

- **Environment Variables**: Secure API key management
- **Input Validation**: Server-side validation for all inputs
- **Rate Limiting**: API request throttling
- **Error Handling**: Secure error messages without exposing internals

## 📊 API Endpoints

- `POST /api/upload-document` - Document upload and parsing
- `POST /api/analyze-resume-with-jd` - Resume analysis
- `POST /api/generate-resume-and-cover-letter` - Document generation
- `POST /api/chat` - AI career coaching chat
- `POST /api/interview-prep` - Interview question generation
- `POST /api/career-development` - Career planning
- `POST /api/search-jobs` - Job search functionality
- `GET /api/job-analytics` - Market insights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation for common solutions
- Ensure your OpenAI API key is valid and has sufficient credits

## 🔄 Updates

- **Regular Updates**: New features and improvements added regularly
- **Bug Fixes**: Continuous maintenance and bug resolution
- **Performance**: Ongoing optimization for better user experience
- **Security**: Regular security updates and patches

---

**Built with ❤️ for career development and professional growth**
