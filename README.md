# AI Career Coach Platform

> AI-powered career coaching platform with resume analysis, interview preparation, cover letter generation, and job search tools.

**Author:** Sylvester Ronith Reagan  
**Live demo:** [ai-career-coach-ronit](https://github.com/ronith2906/ai-career-coach-ronit)

---

## Overview

AI Career Coach is a full-stack web application that helps job seekers improve their materials and prepare for interviews using OpenAI GPT-4. It includes user authentication, subscription tiers, document upload and export, and OAuth sign-in.

### Key Features

- **Resume analysis** — Upload PDF or DOCX resumes and receive structured feedback
- **Cover letter generation** — Tailored cover letters based on job descriptions
- **Interview preparation** — Role-specific questions and coaching responses
- **Career planning** — Personalized career path recommendations
- **User accounts** — JWT authentication with Google and LinkedIn OAuth
- **Subscription tiers** — Free, Pro, and Enterprise usage limits
- **Document export** — Download results as PDF or DOCX

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, Express |
| AI | OpenAI GPT-4 API |
| Database | SQLite |
| Auth | JWT, bcrypt, Google OAuth, LinkedIn OAuth |
| Documents | pdf-parse, mammoth, jsPDF, docx |
| Email | Nodemailer |

---

## Project Structure

```
ai-career-coach-ronit/
├── server.js                  # Main Express server and API routes
├── index.html                 # Landing page
├── ai_career_coach_new.html   # App UI variant
├── ai_career_coach_premium.html
├── career_coach_server.js     # Alternate server entry
├── config.env.example         # Environment variable template
├── package.json
├── DEPLOYMENT.md              # Deployment guide
├── OAUTH_SETUP.md             # OAuth configuration guide
└── email-setup-guide.md       # Email service setup
```

---

## Getting Started

### Prerequisites

- Node.js 18.x
- OpenAI API key
- (Optional) Google and LinkedIn OAuth credentials
- (Optional) SMTP credentials for email features

### Installation

```bash
git clone https://github.com/ronith2906/ai-career-coach-ronit.git
cd ai-career-coach-ronit
npm install
cp config.env.example config.env
# Edit config.env with your API keys and secrets
npm start
```

The server runs on port **3007** by default.

### Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth credentials |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials for email notifications |

See `config.env.example` for the full list.

---

## Additional Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment steps
- [OAUTH_SETUP.md](OAUTH_SETUP.md) — Google and LinkedIn OAuth setup
- [email-setup-guide.md](email-setup-guide.md) — Email configuration

---

## Related Projects

- [ronith-portfolio](https://github.com/ronith2906/ronith-portfolio) — Personal portfolio site
- [AI-Automated-job-agent](https://github.com/ronith2906/AI-Automated-job-agent) — n8n job search automation
- [linkedin-auto-job-applier](https://github.com/ronith2906/linkedin-auto-job-applier) — LinkedIn application bot

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

**Sylvester Ronith Reagan**  
Senior Business & Data Analyst | AI Specialist  
GitHub: [@ronith2906](https://github.com/ronith2906)  
Email: ronith.reagan@gmail.com
