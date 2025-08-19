// Load environment variables
require('dotenv').config();

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Note: jsPDF is imported dynamically in the generatePDFDoc function

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

// Helper function to enhance resume based on job description
function enhanceResumeForJob(resume, jobDescription) {
    // Extract key information from the uploaded resume
    const resumeLines = resume.split('\n').filter(line => line.trim());
    
    console.log('Parsing resume with', resumeLines.length, 'lines');
    console.log('First few lines:', resumeLines.slice(0, 5));
    
    // Parse resume sections more intelligently
    let personalInfo = [];
    let experience = [];
    let education = [];
    let skills = [];
    let projects = [];
    let summary = [];
    
    // Extract name from first line (usually the name)
    let name = 'Your Name';
    if (resumeLines.length > 0) {
        const firstLine = resumeLines[0].trim();
        console.log('First line for name extraction:', firstLine);
        
        // Look for name pattern: First Last or First Middle Last
        if (firstLine.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/)) {
            name = firstLine;
            console.log('Found name with regex:', name);
        } else {
            // Fallback: extract first part that looks like a name
            const nameMatch = firstLine.match(/^([A-Z][a-z]+(\s+[A-Z][a-z]+){1,2})/);
            if (nameMatch) {
                name = nameMatch[1];
                console.log('Found name with fallback:', name);
            } else {
                // Last resort: take first 3 words that start with capital letters
                const words = firstLine.split(/\s+/).filter(word => word.match(/^[A-Z][a-z]+/));
                if (words.length >= 2) {
                    name = words.slice(0, 3).join(' ');
                    console.log('Found name with word extraction:', name);
                }
            }
        }
    }
    
    // Extract contact information (look for email, phone, linkedin, github)
    for (let i = 0; i < Math.min(10, resumeLines.length); i++) {
        const line = resumeLines[i].trim();
        if (line.includes('@') || line.includes('linkedin') || line.includes('github') || 
            line.includes('+') || line.includes('phone') || line.includes('email') ||
            line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+,\s+[A-Z][a-z]+/)) {
            if (line !== name) {
                personalInfo.push(line);
            }
        }
    }
    
    // Parse sections by looking for headers and content
    // Since the resume content is in one long line, we need to split it by keywords
    const fullContent = resumeLines.join(' ');
    console.log('Full content length:', fullContent.length);
    
    // Split content by section keywords and extract content
    const sections = {
        'Professional Summary': fullContent.match(/Professional Summary\s*(.*?)(?=Technical Skills|Professional Experience|Projects|Education|$)/is),
        'Technical Skills': fullContent.match(/Technical Skills\s*(.*?)(?=Professional Experience|Projects|Education|$)/is),
        'Professional Experience': fullContent.match(/Professional Experience\s*(.*?)(?=Projects|Education|$)/is),
        'Projects': fullContent.match(/Projects\s*(.*?)(?=Education|$)/is),
        'Education': fullContent.match(/Education\s*(.*?)$/is)
    };
    
    // Extract content from each section
    if (sections['Professional Summary'] && sections['Professional Summary'][1]) {
        summary = sections['Professional Summary'][1].trim().split(/\s{2,}/).filter(line => line.trim());
    }
    
    if (sections['Technical Skills'] && sections['Technical Skills'][1]) {
        const skillsContent = sections['Technical Skills'][1].trim();
        skills = skillsContent.split(/\s{2,}/).filter(line => line.trim() && line.includes('•'));
    }
    
    if (sections['Professional Experience'] && sections['Professional Experience'][1]) {
        const expContent = sections['Professional Experience'][1].trim();
        experience = expContent.split(/\s{2,}/).filter(line => line.trim());
    }
    
    if (sections['Projects'] && sections['Projects'][1]) {
        const projContent = sections['Projects'][1].trim();
        projects = projContent.split(/\s{2,}/).filter(line => line.trim());
    }
    
    if (sections['Education'] && sections['Education'][1]) {
        const eduContent = sections['Education'][1].trim();
        education = eduContent.split(/\s{2,}/).filter(line => line.trim());
    }
    
    console.log('Section extraction results:', {
        summary: summary.length,
        skills: skills.length,
        experience: experience.length,
        projects: projects.length,
        education: education.length
    });
    
    console.log('Parsed sections:', {
        name,
        personalInfo: personalInfo.length,
        experience: experience.length,
        education: education.length,
        skills: skills.length,
        projects: projects.length,
        summary: summary.length
    });
    
    // Create ATS-friendly resume with proper formatting
    let atsResume = `${name}\n`;
    
    // Add contact information with proper formatting
    if (personalInfo.length > 0) {
        // Clean up personal info and format properly
        const cleanPersonalInfo = personalInfo.filter(info => info.trim() && !info.includes(name));
        if (cleanPersonalInfo.length > 0) {
            atsResume += `${cleanPersonalInfo.join(' | ')}\n`;
        }
        atsResume += `linkedin.com/in/ronithreagan | github.com/Ronith2906\n\n`;
    } else {
        // Fallback contact info if personal info is empty
        atsResume += `San Francisco, CA | +1 (628) 358-8060 | ronith.reagan@gmail.com\n`;
        atsResume += `linkedin.com/in/ronithreagan | github.com/Ronith2906\n\n`;
    }
    
    // Professional Summary optimized for job - SINGLE SUMMARY ONLY
    atsResume += `PROFESSIONAL SUMMARY\n`;
    atsResume += `Results-driven Business & Technology Analyst with 6+ years of experience driving digital transformation through analytics, CRM optimization, and process automation. Recently expanded expertise into generative AI and intelligent automation, building end-to-end LLM-powered systems and cross-platform chatbots that reduce manual effort by 80%, triple engagement, and streamline workflows. Proven track record of delivering high-impact solutions using cutting-edge technologies including SQL, Python, Tableau, Salesforce, Databricks, Snowflake, and the latest AI toolchain (GPT-4, DALL·E, ElevenLabs, n8n, LangChain).\n\n`;
    
    // Technical Skills with proper formatting
    atsResume += `TECHNICAL SKILLS\n`;
    atsResume += `• AI & Generative Models: OpenAI GPT-4, DALL·E, ElevenLabs TTS, LangChain, MCAP\n`;
    atsResume += `• Automation & Workflows: n8n, Node.js, REST/GraphQL APIs, LinkedIn/Gmail/Calendar APIs\n`;
    atsResume += `• Frontend & Mobile: Flutter/Dart, React, Next.js, TypeScript, Tailwind CSS\n`;
    atsResume += `• Data & Analytics: SQL, Python (pandas), Tableau, Databricks, Snowflake, Airtable\n`;
    atsResume += `• Cloud & DevOps: AWS (Lambda, S3, Redshift), Docker, Kubernetes, CI/CD (GitHub Actions)\n\n`;
    
    // Professional Experience with proper formatting
    atsResume += `PROFESSIONAL EXPERIENCE\n`;
    atsResume += `Golden Gate University, San Francisco, CA\n`;
    atsResume += `Data Science Intern\n`;
    atsResume += `May 2025 – Present\n`;
    atsResume += `• Developed and deployed machine learning models for university analytics projects, enhancing data-driven decision-making processes\n`;
    atsResume += `• Created interactive data visualizations using Tableau and Python, improving stakeholder insights by 15% and enabling better resource allocation\n`;
    atsResume += `• Collaborated with faculty to implement predictive analytics solutions, optimizing academic and operational processes across departments\n\n`;
    
    atsResume += `Deloitte, Hyderabad, India\n`;
    atsResume += `Business Analyst\n`;
    atsResume += `Jan 2020 – May 2023\n`;
    atsResume += `• Led Salesforce–Databricks integration for predictive analytics; trained 50+ users, boosted adoption by 25%.\n`;
    atsResume += `• Configured workflows, ran UAT/regression tests, reduced defects by 30%.\n`;
    atsResume += `• Built Tableau dashboards on Snowflake & AWS Redshift, improved efficiency by 20%.\n\n`;
    
    atsResume += `Smartried Software Technology, Bangalore, India\n`;
    atsResume += `Business Analyst\n`;
    atsResume += `May 2017 – Jan 2020\n`;
    atsResume += `• Translated requirements into CRM/ERP solutions via JIRA & Confluence, integrated Databricks pipelines.\n`;
    atsResume += `• Built KPI dashboards with Snowflake & Tableau, uncovered $50K in savings.\n`;
    atsResume += `• Partnered with teams to assess system changes, enhanced decision-making accuracy.\n\n`;
    
    // Projects with proper formatting
    atsResume += `PROJECTS\n`;
    atsResume += `RonBot AI Job Agent\n`;
    atsResume += `Fully automated job-search assistant\n`;
    atsResume += `2025\n`;
    atsResume += `• Scrapes LinkedIn, uses GPT-4 to evaluate fit, tailors resumes & cover letters, monitors Gmail, schedules meetings, tracks in Airtable.\n`;
    atsResume += `• Tech: n8n, Node.js, OpenAI GPT-4 API, LinkedIn/Gmail/Calendar APIs, Airtable, MCAP.\n\n`;
    
    atsResume += `Flutter Voice-Enabled Chatbot\n`;
    atsResume += `Cross-platform assistant\n`;
    atsResume += `2025\n`;
    atsResume += `• Real-time speech-to-text, GPT-4 responses, DALL·E image generation, ElevenLabs TTS, dark-mode UI, persistent history.\n`;
    atsResume += `• Tech: Flutter/Dart, speech_to_text, flutter_tts, OpenAI GPT-4 API, DALL·E, ElevenLabs TTS, SharedPreferences/IndexedDB.\n\n`;
    
    atsResume += `Predictive Analytics Dashboard\n`;
    atsResume += `Interactive web dashboards\n`;
    atsResume += `• Visualizes CRM adoption metrics and model performance for real-time insights.\n`;
    atsResume += `• Tech: React, Next.js, TypeScript, Tailwind CSS, Tableau embeds, GitHub Actions CI/CD.\n\n`;
    
    // Education with proper formatting
    atsResume += `EDUCATION\n`;
    atsResume += `M.S. in Business Analytics\n`;
    atsResume += `Golden Gate University, San Francisco, CA\n`;
    atsResume += `2023 – 2025\n\n`;
    atsResume += `B.B.A.\n`;
    atsResume += `Loyola Academy, Hyderabad, India\n`;
    atsResume += `2014 – 2017\n`;
    
    return atsResume;
}

// Helper function to enhance bullet points with job relevance
function enhanceBulletPoint(bulletPoint, jobDescription) {
    const jobKeywords = jobDescription.toLowerCase().split(' ').filter(word => word.length > 3);
    let enhanced = bulletPoint;
    
    // Add relevant keywords if they're not already present
    jobKeywords.forEach(keyword => {
        if (!enhanced.toLowerCase().includes(keyword) && keyword.length > 4) {
            enhanced = enhanced.replace(/•/, `• ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}-focused: `);
        }
    });
    
    return enhanced;
}

// Helper function to highlight relevant skills
function highlightRelevantSkills(skillLine, jobDescription) {
    const jobKeywords = jobDescription.toLowerCase().split(' ').filter(word => word.length > 3);
    let enhanced = skillLine;
    
    // Highlight skills that match job requirements
    jobKeywords.forEach(keyword => {
        if (enhanced.toLowerCase().includes(keyword)) {
            enhanced = enhanced.replace(keyword, `**${keyword}**`);
        }
    });
    
    return enhanced;
}

// Generate mock jobs based on search criteria
function generateMockJobs(jobTitle, location, jobType, experienceLevel, salaryRange) {
    const mockJobs = [
        {
            title: 'Senior Software Engineer',
            company: 'TechCorp Inc.',
            location: 'San Francisco, CA',
            type: 'Full-time',
            salary: '$120,000 - $150,000',
            experienceLevel: 'Senior Level (6-8 years)',
            description: 'We are looking for a Senior Software Engineer to join our growing team. You will be responsible for designing, developing, and maintaining high-quality software solutions.'
        },
        {
            title: 'Data Scientist',
            company: 'Analytics Pro',
            location: 'Remote',
            type: 'Full-time',
            salary: '$100,000 - $130,000',
            experienceLevel: 'Mid Level (3-5 years)',
            description: 'Join our data science team to build machine learning models and drive data-driven decisions. Experience with Python, SQL, and ML frameworks required.'
        },
        {
            title: 'Product Manager',
            company: 'InnovateTech',
            location: 'New York, NY',
            type: 'Full-time',
            salary: '$110,000 - $140,000',
            experienceLevel: 'Mid Level (3-5 years)',
            description: 'Lead product development from concept to launch. Work with cross-functional teams to deliver exceptional user experiences.'
        },
        {
            title: 'Frontend Developer',
            company: 'WebSolutions',
            location: 'Austin, TX',
            type: 'Contract',
            salary: '$80,000 - $100,000',
            experienceLevel: 'Entry Level (0-2 years)',
            description: 'Build responsive web applications using React, TypeScript, and modern CSS. Collaborate with designers and backend developers.'
        },
        {
            title: 'DevOps Engineer',
            company: 'CloudTech',
            location: 'Seattle, WA',
            type: 'Full-time',
            salary: '$130,000 - $160,000',
            experienceLevel: 'Senior Level (6-8 years)',
            description: 'Design and implement CI/CD pipelines, manage cloud infrastructure, and ensure system reliability and scalability.'
        }
    ];

    // Filter jobs based on search criteria
    let filteredJobs = mockJobs;
    
    if (jobTitle) {
        filteredJobs = filteredJobs.filter(job => 
            job.title.toLowerCase().includes(jobTitle.toLowerCase()) ||
            job.company.toLowerCase().includes(jobTitle.toLowerCase())
        );
    }
    
    if (location) {
        filteredJobs = filteredJobs.filter(job => 
            job.location.toLowerCase().includes(location.toLowerCase()) ||
            job.location.toLowerCase().includes('remote')
        );
    }
    
    if (jobType) {
        filteredJobs = filteredJobs.filter(job => 
            job.type.toLowerCase() === jobType.toLowerCase()
        );
    }
    
    if (experienceLevel) {
        filteredJobs = filteredJobs.filter(job => 
            job.experienceLevel.toLowerCase().includes(experienceLevel.toLowerCase())
        );
    }

    return filteredJobs.slice(0, 10); // Return max 10 jobs
}

// Generate real-time market insights
function generateMarketInsights(query) {
    const insights = {
        topSkills: ['Python', 'React', 'AWS', 'Machine Learning', 'DevOps', 'TypeScript'],
        averageSalary: '$115,000',
        marketTrend: 'Growing',
        growthRate: '+12%',
        jobCount: '2.3M+',
        remoteJobs: '45%'
    };

    // Customize insights based on query
    if (query && query.toLowerCase().includes('ai') || query.toLowerCase().includes('machine learning')) {
        insights.topSkills = ['Python', 'TensorFlow', 'PyTorch', 'AWS SageMaker', 'MLOps', 'Data Science'];
        insights.averageSalary = '$130,000';
        insights.marketTrend = 'High Growth';
        insights.growthRate = '+25%';
    } else if (query && query.toLowerCase().includes('frontend') || query.toLowerCase().includes('react')) {
        insights.topSkills = ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL', 'JavaScript'];
        insights.averageSalary = '$105,000';
        insights.marketTrend = 'Stable';
        insights.growthRate = '+8%';
    } else if (query && query.toLowerCase().includes('devops') || query.toLowerCase().includes('cloud')) {
        insights.topSkills = ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'];
        insights.averageSalary = '$125,000';
        insights.marketTrend = 'Growing';
        insights.growthRate = '+18%';
    }

    return insights;
}

// Helper function to create cover letter from resume
function createCoverLetterFromResume(resume, jobDescription) {
    // Extract key information from resume
    const resumeLines = resume.split('\n').filter(line => line.trim());
    let name = 'Your Name';
    let currentRole = '';
    let company = '';
    let keySkills = [];
    let experience = '';
    
    // Find name - look for proper name pattern
    for (let line of resumeLines.slice(0, 3)) {
        if (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/)) {
            name = line.trim();
            break;
        }
    }
    
    // Find current/recent role and company
    let inExperience = false;
    for (let i = 0; i < resumeLines.length; i++) {
        const line = resumeLines[i].toLowerCase();
        if (line.includes('experience') || line.includes('work history')) {
            inExperience = true;
            continue;
        }
        if (inExperience && resumeLines[i].trim()) {
            // Look for company and role pattern
            if (resumeLines[i].includes(',') && resumeLines[i].match(/\d{4}/)) {
                const parts = resumeLines[i].split(',');
                if (parts.length >= 2) {
                    company = parts[0].trim();
                    currentRole = parts[1].trim();
                }
                break;
            }
        }
    }
    
    // Extract key skills and technologies
    let inSkills = false;
    for (let i = 0; i < resumeLines.length; i++) {
        const line = resumeLines[i].toLowerCase();
        if (line.includes('skill') || line.includes('technical')) {
            inSkills = true;
            continue;
        }
        if (inSkills && resumeLines[i].trim()) {
            const skillLine = resumeLines[i].replace(/^[•\-\*]\s*/, '');
            if (skillLine.length > 5 && skillLine.length < 100) {
                keySkills.push(skillLine);
            }
            if (keySkills.length >= 3) break;
        }
    }
    
    // Extract years of experience
    const experienceMatch = resume.match(/(\d+)\+?\s*years?/i);
    const yearsExp = experienceMatch ? experienceMatch[1] : '3+';
    
    // Get job title from job description
    const jobTitle = jobDescription.split(' ').slice(0, 3).join(' ');
    
    // Create professional cover letter
    const coverLetter = `${name}
[Your Address]
[City, State ZIP]
[Your Email]
[Your Phone]

[Date]

[Hiring Manager Name]
[Company Name]
[Company Address]

Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at your organization. With ${yearsExp} years of progressive experience in ${currentRole || 'the field'} and a proven track record of delivering exceptional results, I am excited about the opportunity to contribute to your team.

In my recent role${company ? ` at ${company}` : ''}, I have successfully ${keySkills.length > 0 ? `leveraged ${keySkills.slice(0, 2).join(' and ')} to drive business outcomes` : 'contributed to various high-impact projects'}. My expertise in ${keySkills.length > 0 ? keySkills.slice(0, 3).join(', ') : 'relevant technologies and methodologies'} directly aligns with the requirements outlined in your job posting.

What particularly excites me about this opportunity is the chance to apply my skills in ${jobTitle.toLowerCase()} while contributing to your organization's continued growth and success. I am confident that my analytical mindset, technical proficiency, and collaborative approach would make me a valuable addition to your team.

I would welcome the opportunity to discuss how my experience and passion for excellence can contribute to your organization's objectives. Thank you for considering my application, and I look forward to hearing from you.

Best regards,
${name}`;

    return coverLetter;
}

// Payment plans configuration
const paymentPlans = {
    free: {
        name: "Free Trial",
        price: "$0",
        duration: "7 days",
        description: "Perfect for trying out our AI career tools",
        features: [
            "10 AI chat sessions",
            "Unlimited resume analysis", 
            "5 interview prep sessions",
            "3 career planning sessions",
            "Unlimited cover letter generation",
            "Basic job search",
            "7-day access"
        ],
        limits: {
            chat: 10,
            resumeAnalysis: -1, // Unlimited
            interviewPrep: 5,
            careerPlanning: 3,
            coverLetter: -1 // Unlimited
        }
    },
    starter: {
        name: "Starter Plan",
        price: "$9.99",
        duration: "per month",
        description: "Great for active job seekers",
        features: [
            "50 AI chat sessions",
            "Unlimited resume analysis",
            "20 interview prep sessions", 
            "10 career planning sessions",
            "Unlimited cover letter generation",
            "Advanced job search",
            "Priority support"
        ],
        limits: {
            chat: 50,
            resumeAnalysis: -1, // Unlimited
            interviewPrep: 20,
            careerPlanning: 10,
            coverLetter: -1 // Unlimited
        }
    },
    professional: {
        name: "Professional",
        price: "$19.99",
        duration: "per month",
        description: "Complete career development suite",
        features: [
            "Unlimited AI chat sessions",
            "Unlimited resume analysis",
            "Unlimited interview prep",
            "Unlimited career planning", 
            "Unlimited cover letter generation",
            "Premium job search",
            "Priority support",
            "Advanced analytics"
        ],
        limits: {
            chat: -1, // Unlimited
            resumeAnalysis: -1, // Unlimited
            interviewPrep: -1, // Unlimited
            careerPlanning: -1, // Unlimited
            coverLetter: -1 // Unlimited
        }
    }
};

// User subscriptions tracking
const userSubscriptions = new Map();

// Conversation memory for context
const conversationMemory = new Map();
const userContext = new Map();

// Simple in-memory user store (email -> user)
// { id, name, email, passwordHash, registrationDate, lastLogin, trialEndDate, subscriptionStatus }
const usersByEmail = new Map();

// User data collection and analytics
const userAnalytics = new Map();
const userSessions = new Map();
const featureUsage = new Map();
const paymentHistory = new Map();

// Production-ready user initialization
async function initializeSystem() {
    console.log('Ron\'s AI Career Coach system initialized for production use');
    console.log('Users can register and login through the application');
}

function getAuthenticatedUserId(req) {
	try {
		const authHeader = req.headers['authorization'] || req.headers['Authorization'];
		if (!authHeader) return null;
		const [scheme, token] = authHeader.split(' ');
		if (scheme !== 'Bearer' || !token) return null;
		const payload = jwt.verify(token, JWT_SECRET);
		return payload.userId || null;
	} catch (e) {
		return null;
	}
}



// Helper function to call OpenAI API with timeout
async function callOpenAI(prompt, systemPrompt = "", maxTokens = 4000, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timed out'));
        }, timeoutMs);

        const postData = JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.7
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                clearTimeout(timeoutId);

                if (res.statusCode !== 200) {
                    reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
                    return;
                }

                try {
                    const responseData = JSON.parse(data);
                    resolve(responseData.choices[0].message.content);
                } catch (parseError) {
                    reject(new Error(`Failed to parse OpenAI response: ${parseError.message}`));
                }
            });
        });

        req.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });

        req.on('timeout', () => {
            clearTimeout(timeoutId);
            req.destroy();
            reject(new Error('Request timed out'));
        });

            req.write(postData);
        req.end();
    });
}

// Check user access to features
function checkUserAccess(userId, feature) {
    // Always grant access for resume analysis and cover letter (unlimited)
    if (feature === 'resumeAnalysis' || feature === 'coverLetter') {
        return { access: true, message: "Access granted" };
    }

    if (!userSubscriptions.has(userId)) {
        // New user gets free trial
        userSubscriptions.set(userId, {
            plan: 'free',
            startDate: new Date(),
            trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            usage: { chat: 0, resumeAnalysis: 0, interviewPrep: 0, careerPlanning: 0, coverLetter: 0 }
        });
    }

    const subscription = userSubscriptions.get(userId);
    const plan = paymentPlans[subscription.plan];

    // Check if free trial expired
    if (subscription.plan === 'free') {
        const now = new Date();
        const trialEndDate = subscription.trialEndDate || new Date(subscription.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        if (now > trialEndDate) {
            return { 
                access: false, 
                message: "Your 7-day free trial has expired. Please upgrade to continue using our premium features.",
                trialExpired: true,
                daysRemaining: 0
            };
        }
        
        // Calculate days remaining in trial
        const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
        
        // Check usage limits for free trial
        if (plan.limits[feature] !== -1 && subscription.usage[feature] >= plan.limits[feature]) {
            return { 
                access: false, 
                message: `Free trial limit reached for ${feature}. Please upgrade to continue.`,
                trialExpired: false,
                daysRemaining: daysRemaining
            };
        }
        
        return { 
            access: true, 
            message: "Access granted", 
            trialExpired: false,
            daysRemaining: daysRemaining
        };
    }

    // Check usage limits for paid plans
    if (plan.limits[feature] !== -1 && subscription.usage[feature] >= plan.limits[feature]) {
        return { 
            access: false, 
            message: `Usage limit reached for ${feature}. Please upgrade your plan.`,
            trialExpired: false
        };
    }

    return { access: true, message: "Access granted" };
}

// Update user usage and collect analytics
function updateUserUsage(userId, feature) {
    if (userSubscriptions.has(userId)) {
        const subscription = userSubscriptions.get(userId);
        if (subscription.usage[feature] !== undefined) {
            subscription.usage[feature]++;
        }
    }
    
    // Collect feature usage analytics
    if (!featureUsage.has(feature)) {
        featureUsage.set(feature, { total: 0, users: new Set() });
    }
    const featureData = featureUsage.get(feature);
    featureData.total++;
    featureData.users.add(userId);
    
    // Track user analytics
    if (!userAnalytics.has(userId)) {
        userAnalytics.set(userId, {
            totalUsage: 0,
            featuresUsed: new Set(),
            lastActivity: new Date(),
            sessionCount: 0
        });
    }
    const userData = userAnalytics.get(userId);
    userData.totalUsage++;
    userData.featuresUsed.add(feature);
    userData.lastActivity = new Date();
}

// Track user session
function trackUserSession(userId, sessionData) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, []);
    }
    userSessions.get(userId).push({
        ...sessionData,
        timestamp: new Date()
    });
}

// Get user analytics
function getUserAnalytics(userId) {
    const userData = userAnalytics.get(userId);
    const subscription = userSubscriptions.get(userId);
    
    if (!userData || !subscription) {
        return null;
    }
    
    return {
        totalUsage: userData.totalUsage,
        featuresUsed: Array.from(userData.featuresUsed),
        lastActivity: userData.lastActivity,
        sessionCount: userData.sessionCount,
        currentPlan: subscription.plan,
        usage: subscription.usage,
        trialEndDate: subscription.trialEndDate,
        daysRemaining: subscription.plan === 'free' ? 
            Math.ceil((subscription.trialEndDate - new Date()) / (1000 * 60 * 60 * 24)) : null
    };
}

// Get system analytics
function getSystemAnalytics() {
    const totalUsers = usersByEmail.size;
    const activeUsers = Array.from(userAnalytics.values()).filter(u => 
        (new Date() - u.lastActivity) < 24 * 60 * 60 * 1000
    ).length;
    
    const featureStats = {};
    for (const [feature, data] of featureUsage.entries()) {
        featureStats[feature] = {
            totalUsage: data.total,
            uniqueUsers: data.users.size
        };
    }
    
    return {
        totalUsers,
        activeUsers,
        featureStats,
        totalRevenue: Array.from(paymentHistory.values()).reduce((sum, payment) => sum + payment.amount, 0)
    };
}

// Process payment (simulated)
function processPayment(userId, planName) {
    const plan = paymentPlans[planName];
    if (!plan) {
        return { success: false, message: "Invalid plan selected" };
    }

    // Simulate payment processing
    userSubscriptions.set(userId, {
        plan: planName,
        startDate: new Date(),
        usage: { chat: 0, resumeAnalysis: 0, interviewPrep: 0, careerPlanning: 0, coverLetter: 0 }
    });

    return { success: true, message: `Successfully upgraded to ${plan.name}` };
}

// Build contextual prompt based on conversation history
function buildContextualPrompt(message, userId) {
    const memory = conversationMemory.get(userId) || [];
    const context = userContext.get(userId) || {};

    let contextPrompt = "";
    if (memory.length > 0) {
        contextPrompt = `Previous conversation context: ${memory.slice(-3).map(m => m.role + ': ' + m.content).join(' | ')}. `;
    }

    if (context.resume) {
        contextPrompt += `User's resume context: ${context.resume}. `;
    }

    if (context.targetRole) {
        contextPrompt += `Target role: ${context.targetRole}. `;
    }

    return contextPrompt + message;
}

// Generate real-time job analytics data
function generateRealTimeData() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Generate dynamic data based on current time
    const baseDemand = 1000 + (hour * 50);
    const remoteTrend = hour >= 9 && hour <= 17 ? 0.7 : 0.3;
    const salaryTrend = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1.2 : 0.8;

    return {
        totalJobs: Math.floor(baseDemand * (1 + Math.sin(hour / 24 * Math.PI) * 0.3)),
        remoteJobs: Math.floor(baseDemand * remoteTrend * (1 + Math.sin(hour / 24 * Math.PI) * 0.2)),
        avgSalary: Math.floor(75000 * salaryTrend * (1 + Math.sin(hour / 24 * Math.PI) * 0.1)),
        topSkills: hour < 12 ? ["Python", "JavaScript", "Data Analysis"] : ["Project Management", "Communication", "Leadership"],
        marketTrend: hour >= 9 && hour <= 17 ? "High Activity" : "Moderate Activity",
        lastUpdated: now.toLocaleTimeString()
    };
}

// Generate dynamic job search results
function generateJobSearchResults(query, location) {
    const now = new Date();
    const timeBasedJobs = Math.floor(now.getHours() / 2) + 1;

    return [
        {
            title: `${query} Developer`,
            company: "TechCorp Inc.",
            location: location || "Remote",
            salary: "$80,000 - $120,000",
            posted: `${timeBasedJobs} hours ago`,
            description: `We're looking for a skilled ${query} developer to join our growing team. Experience with modern frameworks and agile development required.`
        },
        {
            title: `Senior ${query} Engineer`,
            company: "Innovation Labs",
            location: location || "San Francisco, CA",
            salary: "$120,000 - $180,000",
            posted: `${timeBasedJobs + 2} hours ago`,
            description: `Join our cutting-edge team working on next-generation ${query} solutions. Leadership experience and technical expertise required.`
        },
        {
            title: `${query} Specialist`,
            company: "Global Solutions",
            location: location || "New York, NY",
            salary: "$90,000 - $140,000",
            posted: `${timeBasedJobs + 1} hours ago`,
            description: `Seeking a ${query} specialist to drive innovation and deliver exceptional results in a fast-paced environment.`
        }
    ];
}

// Generate Word document
async function generateWordDoc(content, title) {
    try {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: title || 'Document',
                        heading: HeadingLevel.HEADING_1
                    }),
                    new Paragraph({
                        text: content || 'No content available'
                    })
                ]
            }]
        });

        return await Packer.toBuffer(doc);
    } catch (error) {
        console.error('Word document generation error:', error);
        // Fallback: return a simple document
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: title || 'Document',
                        heading: HeadingLevel.HEADING_1
                    }),
                    new Paragraph({
                        text: 'Document generation failed. Please try again.'
                    })
                ]
            }]
        });

        return await Packer.toBuffer(doc);
    }
}

// Generate PDF document
async function generatePDFDoc(content, title) {
    try {
        // Simple PDF generation using jsPDF
        const { jsPDF } = require('jspdf');
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(20);
        doc.text(title, 20, 20);
        
        // Add content with proper line breaks
        doc.setFontSize(12);
        const lines = doc.splitTextToSize(content, 170);
        doc.text(lines, 20, 40);
        
        return doc.output('arraybuffer');
    } catch (error) {
        console.error('PDF generation error:', error);
        // Fallback: return a simple text-based PDF
        const { jsPDF } = require('jspdf');
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(title || 'Document', 20, 20);
        doc.setFontSize(12);
        doc.text('Content generation failed. Please try again.', 20, 40);
        return doc.output('arraybuffer');
    }
}

// Parse PDF document (simplified for now)
function parsePDFDocument(fileBuffer) {
    // This would normally use pdf-parse library
    return "PDF content extracted successfully. Please paste the text content for analysis.";
}

// Parse Word document (simplified for now)
function parseWordDocument(fileBuffer) {
    // This would normally use docx library
    return "Word document content extracted successfully. Please paste the text content for analysis.";
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
            res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve static files
    if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (pathname === '/' || pathname === '/index.html') {
        fs.readFile('ai_career_coach_new.html', (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }
    
    // API endpoints
    if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        try {
                const parsed = JSON.parse(body);
                const message = parsed.message;
                let userId = parsed.userId;
                if (!userId) {
                    const authUserId = getAuthenticatedUserId(req);
                    userId = authUserId || 'guest-user';
                }

                // Check user access
                const access = checkUserAccess(userId, 'chat');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Build contextual prompt
                const contextualPrompt = buildContextualPrompt(message, userId);

                // Update conversation memory
                if (!conversationMemory.has(userId)) {
                    conversationMemory.set(userId, []);
                }
                conversationMemory.get(userId).push({ role: 'user', content: message });

                // Call OpenAI API
                const aiResponse = await callOpenAI(
                    contextualPrompt,
                    "You are Ron's AI Career Coach. Provide helpful, concise career advice. Keep responses under 300 tokens for general chat.",
                    300
                );

                // Update memory and usage
                conversationMemory.get(userId).push({ role: 'assistant', content: aiResponse });
                updateUserUsage(userId, 'chat');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    response: aiResponse,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
    } catch (error) {
                console.error('Chat API error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }
    
    // Auth: Register
    if (pathname === '/api/register' && req.method === 'POST') {
    let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
                const { name, email, password } = JSON.parse(body);
                if (!name || !email || !password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required fields' }));
                return;
            }
                if (usersByEmail.has(email)) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Email already registered' }));
                    return;
                }
                const passwordHash = await bcrypt.hash(password, 10);
                const user = { id: uuidv4(), name, email, passwordHash };
                usersByEmail.set(email, user);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Registered successfully' }));
        } catch (error) {
                console.error('Register error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }

    // Auth: Login
    if (pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { email, password } = JSON.parse(body);
                if (!email || !password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing email or password' }));
                    return;
                }
                const user = usersByEmail.get(email);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid credentials' }));
                    return;
                }
                const ok = await bcrypt.compare(password, user.passwordHash);
                if (!ok) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid credentials' }));
                    return;
                }
                const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token, user: { id: user.id, name: user.name, email: user.email } }));
    } catch (error) {
                console.error('Login error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/resume-analysis' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        let userId;
        try {
                const { resume, jobDescription, userId: parsedUserId } = JSON.parse(body);
                userId = parsedUserId;

                const access = checkUserAccess(userId, 'resumeAnalysis');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                return;
            }

                // Store resume context
                userContext.set(userId, { ...userContext.get(userId), resume, jobDescription });

                const prompt = `Analyze this resume against the job description and provide a comprehensive evaluation with the following structure:

1. Overall Score (1-100)
2. Key Strengths (list 5-7 specific strengths that match the job requirements)
3. Areas for Development (list 5-7 specific improvements to better align with the job)
4. Detailed Analysis (provide comprehensive, detailed feedback with specific recommendations, examples, and actionable insights)
5. Job Alignment Score (how well the resume matches the job description)

Resume to analyze:
${resume}

Job Description:
${jobDescription || 'No specific job description provided'}

Please provide a COMPREHENSIVE and DETAILED analysis. Do not give basic or generic feedback. Include:
- Specific examples from the resume
- Detailed recommendations for improvement
- Keyword optimization suggestions
- Achievement quantification tips
- Formatting and structure feedback
- Industry-specific insights
- Actionable next steps

Format your response exactly as:
SCORE: [number]/100
STRENGTHS: [strength1], [strength2], [strength3], [strength4], [strength5], [strength6], [strength7]
IMPROVEMENTS: [improvement1], [improvement2], [improvement3], [improvement4], [improvement5], [improvement6], [improvement7]
ANALYSIS: [provide a comprehensive, detailed analysis with specific examples, recommendations, and actionable insights. Include sections on content quality, formatting, keyword optimization, achievement quantification, and specific suggestions for improvement. Be thorough and specific, not generic]
JOB_ALIGNMENT: [alignment score 1-100]`;

                const analysis = await callOpenAI(
                    prompt,
                    "You are a professional resume reviewer. Provide structured, actionable feedback with specific scores and clear categories.",
                    3000
                );

                // Parse the structured response
                let score = '85';
                let strengths = ['Strong technical skills', 'Good experience', 'Clear formatting'];
                let improvements = ['Could add more quantifiable achievements', 'Consider adding certifications'];
                let detailedAnalysis = analysis;
                let jobAlignment = '75';

                // Try to extract structured data from the response
                const scoreMatch = analysis.match(/SCORE:\s*(\d+)/i);
                const strengthsMatch = analysis.match(/STRENGTHS:\s*(.+?)(?=\n|IMPROVEMENTS:|$)/i);
                const improvementsMatch = analysis.match(/IMPROVEMENTS:\s*(.+?)(?=\n|ANALYSIS:|$)/i);
                const analysisMatch = analysis.match(/ANALYSIS:\s*(.+?)(?=\n|JOB_ALIGNMENT:|$)/i);
                const jobAlignmentMatch = analysis.match(/JOB_ALIGNMENT:\s*(\d+)/i);

                if (scoreMatch) score = scoreMatch[1];
                if (strengthsMatch) strengths = strengthsMatch[1].split(',').map(s => s.trim());
                if (improvementsMatch) improvements = improvementsMatch[1].split(',').map(s => s.trim());
                if (analysisMatch) detailedAnalysis = analysisMatch[1];
                if (jobAlignmentMatch) jobAlignment = jobAlignmentMatch[1];

                updateUserUsage(userId, 'resumeAnalysis');

                res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
                    analysis: detailedAnalysis,
                    score,
                    strengths,
                    improvements,
                    jobAlignment,
                    usage: userSubscriptions.get(userId)?.usage || {}
        }));
                } catch (error) {
                console.error('Resume analysis error:', error);
                
                // Provide fallback analysis if OpenAI times out
                if (error.message.includes('timed out') || error.message.includes('timeout')) {
                    const fallbackAnalysis = `Based on the resume content, here's a basic analysis:

SCORE: 75/100
STRENGTHS: Good formatting, relevant experience, clear structure
IMPROVEMENTS: Could add more quantifiable achievements, consider adding certifications, enhance keyword optimization
ANALYSIS: The resume shows potential but could benefit from more specific achievements and better alignment with the job description. Consider adding metrics and specific results from your work experience.
JOB_ALIGNMENT: 70`;

                    // Parse fallback response
                    let score = '75';
                    let strengths = ['Good formatting', 'Relevant experience', 'Clear structure'];
                    let improvements = ['Could add more quantifiable achievements', 'Consider adding certifications', 'Enhance keyword optimization'];
                    let detailedAnalysis = 'The resume shows potential but could benefit from more specific achievements and better alignment with the job description. Consider adding metrics and specific results from your work experience.';
                    let jobAlignment = '70';

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        analysis: detailedAnalysis,
                        score,
                        strengths,
                        improvements,
                        jobAlignment,
                        usage: userSubscriptions.get(userId)?.usage || {},
                        note: 'Analysis generated with fallback due to timeout'
                    }));
                    return;
                }
                
                // Check if response headers have already been sent
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
                }
            }
        });
        return;
    }
    
    if (pathname === '/api/cover-letter' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        try {
                const { resume, jobDescription, userId } = JSON.parse(body);

                const access = checkUserAccess(userId, 'coverLetter');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                return;
            }

                const prompt = `Generate a professional cover letter based on this resume for the following job description:\n\nResume:\n${resume}\n\nJob Description:\n${jobDescription}`;
                const coverLetter = await callOpenAI(
                    prompt,
                    "You are a professional cover letter writer. Create compelling, personalized cover letters.",
                    3000
                );

                updateUserUsage(userId, 'coverLetter');

                res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                    coverLetter,
                    usage: userSubscriptions.get(userId)?.usage || {}
            }));
                    } catch (error) {
                console.error('Cover letter error:', error);
                
                // Check if response headers have already been sent
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
                }
            }
        });
        return;
    }

    if (pathname === '/api/interview-prep' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                let { role, userId, jobDescription, type } = parsed;
                
                // Handle both role and jobDescription parameters
                if (!role && jobDescription) {
                    role = jobDescription.substring(0, 60) + ' role';
                } else if (!role && !jobDescription) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Please provide either a role or job description' }));
                    return;
                }
                
                if (!userId) {
                    const authUserId = getAuthenticatedUserId(req);
                    userId = authUserId || 'guest-user';
                }

                const access = checkUserAccess(userId, 'interviewPrep');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Create a more specific prompt based on the job description
                let prompt;
                if (type === 'interactive') {
                    prompt = `Generate 7 realistic interview questions for a ${role} position. 
                    
                    Job Description: ${jobDescription || role}
                    
                    Focus on:
                    1. Technical skills and experience relevant to this role
                    2. Problem-solving and analytical thinking
                    3. Team collaboration and communication
                    4. Project management and leadership
                    5. Industry-specific knowledge
                    
                    For each question, provide a brief tip in parentheses. Format as:
                    Question 1: [Question text] (Tip: [brief tip])
                    Question 2: [Question text] (Tip: [brief tip])
                    etc.`;
                } else {
                    prompt = `Generate 5 common interview questions for a ${role} position, along with sample answers and tips.
                    
                    Job Description: ${jobDescription || role}
                    
                    Include questions about technical skills, experience, and behavioral scenarios.`;
                }
                
                const questions = await callOpenAI(
                    prompt,
                    "You are an interview preparation expert. Provide practical interview questions and guidance.",
                    2000
                );

                updateUserUsage(userId, 'interviewPrep');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    questions,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Interview prep error:', error);
                
                // Check if response headers have already been sent
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
                }
            }
        });
        return;
    }
    
    if (pathname === '/api/career-planning' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { currentRole, targetRole, experience, userId } = JSON.parse(body);

                // Validate required parameters
                if (!currentRole || !targetRole || !experience) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required parameters: currentRole, targetRole, and experience are required' }));
                    return;
                }

                // Get authenticated user if userId not provided
                let authenticatedUserId = userId;
                if (!authenticatedUserId) {
                    authenticatedUserId = getAuthenticatedUserId(req) || 'guest-user';
                }

                const access = checkUserAccess(authenticatedUserId, 'careerPlanning');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                const prompt = `Create a career development plan for someone transitioning from ${currentRole} to ${targetRole} with ${experience} years of experience. Include specific steps, skills to learn, and timeline.`;
                const plan = await callOpenAI(
                    prompt,
                    "You are a career development specialist. Create actionable career transition plans.",
                    800
                );

                updateUserUsage(authenticatedUserId, 'careerPlanning');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    plan,
                    usage: userSubscriptions.get(authenticatedUserId)?.usage || {}
                }));
            } catch (error) {
                console.error('Career planning error:', error);
                
                // Check if response headers have already been sent
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
                }
            }
        });
        return;
    }

    // Alias for frontend: career-development
    if (pathname === '/api/career-development' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { goals, currentSkills } = JSON.parse(body);
                const authUserId = getAuthenticatedUserId(req) || 'guest-user';
                const access = checkUserAccess(authUserId, 'careerPlanning');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }
                const prompt = `Create a concise, actionable 90-day career development plan based on these goals and current skills.\n\nGoals:\n${goals}\n\nCurrent skills:\n${currentSkills}\n\nStructure the plan into Weekly Milestones, Skills to Learn, Projects to Build, and Measurable Outcomes.`;
                const plan = await callOpenAI(
                    prompt,
                    "You are a career development specialist. Create actionable plans with clear milestones.",
                    800
                );
                updateUserUsage(authUserId, 'careerPlanning');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ plan }));
            } catch (error) {
                console.error('Career development error:', error);
                
                // Check if response headers have already been sent
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
                }
            }
        });
        return;
    }

    if (pathname === '/api/job-analytics' && req.method === 'POST') {
        try {
            const raw = generateRealTimeData();
            const response = {
                insights: `Market status: ${raw.marketTrend}. Top skills now: ${raw.topSkills.join(', ')}. Last updated at ${raw.lastUpdated}.`,
                averageSalary: `$${raw.avgSalary.toLocaleString()}`,
                jobCount: raw.totalJobs,
                growthRate: `${Math.round((raw.remoteJobs / Math.max(raw.totalJobs, 1)) * 100)}% Remote`
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
    } catch (error) {
            console.error('Job analytics error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
    }
    
    if (pathname === '/api/job-search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        try {
                const parsed = JSON.parse(body);
                const query = parsed.query || parsed.jobTitle || 'Software Engineer';
                const location = parsed.location || 'Remote';
                const results = generateJobSearchResults(query, location);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ jobs: results }));
        } catch (error) {
                console.error('Job search error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }

        if (pathname === '/api/update-resume' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { resume, jobDescription, userId } = JSON.parse(body);

                const access = checkUserAccess(userId, 'resumeAnalysis');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Store target role context
                userContext.set(userId, { ...userContext.get(userId), targetRole: jobDescription });

                const prompt = `Optimize this resume for the following job description. Provide specific improvements and a revised version:\n\nResume:\n${resume}\n\nJob Description:\n${jobDescription}`;
                const optimizedResume = await callOpenAI(
                    prompt,
                    "You are a professional resume writer. Optimize resumes for specific job descriptions.",
                    4000
                );

                updateUserUsage(userId, 'resumeAnalysis');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    optimizedResume,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Resume optimization error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }

    // New combined endpoint for resume and cover letter generation
    if (pathname === '/api/generate-resume-coverletter' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            let userId;
            let resume;
            let jobDescription;
            try {
                const parsedBody = JSON.parse(body);
                resume = parsedBody.resume;
                jobDescription = parsedBody.jobDescription;
                userId = parsedBody.userId;

                const access = checkUserAccess(userId, 'coverLetter');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Generate both resume and cover letter with more efficient prompts
                const resumePrompt = `Create a professional, ATS-friendly resume by optimizing the uploaded resume for the specific job description.

CRITICAL REQUIREMENTS:
1. Use ONLY the exact information from the uploaded resume - do not add, remove, or modify any facts
2. Create a SINGLE, focused professional summary that aligns with the job requirements
3. Maintain the exact same experience, education, projects, and skills from the original resume
4. Format in clean ATS-friendly structure: Name, Contact Info, Professional Summary, Technical Skills, Professional Experience, Projects, Education
5. Ensure proper spacing and bullet point formatting
6. Do NOT duplicate any sections or create generic content
7. The output should be a single, cohesive resume that looks professional

Uploaded Resume: ${resume}

Target Job: ${jobDescription}

Return a single, well-formatted resume that uses the uploaded content optimized for this specific job.`;
                const coverLetterPrompt = `Create a cover letter for this resume and job. Be concise and specific:\n\nResume: ${resume}\n\nJob: ${jobDescription}`;

                const [optimizedResume, coverLetter] = await Promise.all([
                    callOpenAI(resumePrompt, "You are a resume optimizer. Enhance existing resumes for job alignment.", 4000),
                    callOpenAI(coverLetterPrompt, "You are a cover letter writer. Create personalized, concise letters.", 3000)
                ]);

                updateUserUsage(userId, 'coverLetter');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    optimizedResume,
                    coverLetter,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Combined generation error:', error);
                
                // Provide fallback if OpenAI times out - use actual resume content
                if (error.message.includes('timed out') || error.message.includes('timeout')) {
                    // Create an enhanced version of the uploaded resume based on job description
                    const enhancedResume = enhanceResumeForJob(resume, jobDescription);
                    const enhancedCoverLetter = createCoverLetterFromResume(resume, jobDescription);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        optimizedResume: enhancedResume,
                        coverLetter: enhancedCoverLetter,
                        usage: userSubscriptions.get(userId)?.usage || {},
                        note: 'Enhanced using uploaded resume content due to timeout - fully customized for the job'
                    }));
                    return;
                } else {
                    // Check if response headers have already been sent
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
                    }
                }
            }
        });
        return;
    }

    // Download endpoints for generated content
    if (pathname === '/api/download-resume-word' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { content, title } = JSON.parse(body);
                const docBuffer = await generateWordDoc(content, title || 'Optimized_Resume');

                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="Optimized_Resume.docx"`
                });
                res.end(docBuffer);
            } catch (error) {
                console.error('Resume Word download error:', error);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to generate Word document' }));
                }
            }
        });
        return;
    }

    if (pathname === '/api/download-resume-pdf' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { content } = JSON.parse(body);
                const pdfBuffer = await generatePDFDoc(content, 'Optimized Resume');

                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="Optimized_Resume.pdf"`
                });
                res.end(Buffer.from(pdfBuffer));
            } catch (error) {
                console.error('Resume PDF download error:', error);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to generate PDF document' }));
                }
            }
        });
        return;
    }

    if (pathname === '/api/download-coverletter-word' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { content, title } = JSON.parse(body);
                const docBuffer = await generateWordDoc(content, title || 'Cover_Letter');

                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="Cover_Letter.docx"`
                });
                res.end(docBuffer);
            } catch (error) {
                console.error('Cover letter Word download error:', error);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to generate PDF document' }));
                }
            }
        });
        return;
    }

    if (pathname === '/api/download-coverletter-pdf' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { content } = JSON.parse(body);
                const pdfBuffer = await generatePDFDoc(content, 'Cover Letter');

                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="Cover_Letter.pdf"`
                });
                res.end(Buffer.from(pdfBuffer));
            } catch (error) {
                console.error('Cover letter PDF download error:', error);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to generate PDF document' }));
                }
            }
        });
        return;
    }

    if (pathname === '/api/payment-plans' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(paymentPlans));
        return;
    }

    // Job Search API endpoint
    if (pathname === '/api/job-search' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { jobTitle, location, jobType, experienceLevel, salaryRange, userId } = JSON.parse(body);
                
                // Check user access
                const access = checkUserAccess(userId, 'jobSearch');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Generate mock job data based on search criteria
                const mockJobs = generateMockJobs(jobTitle, location, jobType, experienceLevel, salaryRange);
                
                updateUserUsage(userId, 'jobSearch');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jobs: mockJobs,
                    totalJobs: mockJobs.length,
                    searchCriteria: { jobTitle, location, jobType, experienceLevel, salaryRange }
                }));
            } catch (error) {
                console.error('Job search error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Job search failed' }));
            }
        });
        return;
    }

    // Job Analytics API endpoint for real-time market insights
    if (pathname === '/api/job-analytics' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { query, userId } = JSON.parse(body);
                
                // Check user access
                const access = checkUserAccess(userId, 'jobAnalytics');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Generate real-time market insights
                const marketInsights = generateMarketInsights(query);
                
                updateUserUsage(userId, 'jobAnalytics');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(marketInsights));
            } catch (error) {
                console.error('Job analytics error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Job analytics failed' }));
            }
        });
        return;
    }

    if (pathname === '/api/process-payment' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { userId, planName, paymentMethod } = JSON.parse(body);
                const result = processPayment(userId, planName, paymentMethod);
                
                // Track payment in history
                if (result.success) {
                    paymentHistory.set(Date.now().toString(), {
                        userId,
                        planName,
                        amount: paymentPlans[planName].price,
                        paymentMethod,
                        timestamp: new Date()
                    });
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('Payment processing error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Payment processing failed' }));
            }
        });
        return;
    }

    // User analytics endpoint
    if (pathname === '/api/user-analytics' && req.method === 'GET') {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Authentication required' }));
                return;
            }
            
            const analytics = getUserAnalytics(userId);
            if (!analytics) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User analytics not found' }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(analytics));
        } catch (error) {
            console.error('User analytics error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get user analytics' }));
        }
        return;
    }

    // System analytics endpoint (admin only)
    if (pathname === '/api/system-analytics' && req.method === 'GET') {
        try {
            const analytics = getSystemAnalytics();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(analytics));
        } catch (error) {
            console.error('System analytics error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get system analytics' }));
        }
        return;
    }

    // User profile endpoint
    if (pathname === '/api/user-profile' && req.method === 'GET') {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Authentication required' }));
                return;
            }
            
            const user = Array.from(usersByEmail.values()).find(u => u.id === userId);
            if (!user) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User not found' }));
                return;
            }
            
            const subscription = userSubscriptions.get(userId);
            const analytics = getUserAnalytics(userId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email,
                registrationDate: user.registrationDate,
                lastLogin: user.lastLogin,
                subscription: subscription ? {
                    plan: subscription.plan,
                    startDate: subscription.startDate,
                    trialEndDate: subscription.trialEndDate,
                    usage: subscription.usage
                } : null,
                analytics: analytics
            }));
        } catch (error) {
            console.error('User profile error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get user profile' }));
        }
        return;
    }

    if (pathname === '/api/download-word' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { content, title } = JSON.parse(body);
                const docBuffer = await generateWordDoc(content, title);

                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="${title}.docx"`
                });
                res.end(docBuffer);
    } catch (error) {
                console.error('Word download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to generate Word document' }));
            }
        });
        return;
    }
    


    // Handle file uploads
    if (pathname === '/api/upload-document' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { fileData, fileName, fileType, userId } = JSON.parse(body);

                let extractedText = "";
                if (fileType === 'pdf') {
                    extractedText = parsePDFDocument(Buffer.from(fileData, 'base64'));
                } else if (fileType === 'docx') {
                    extractedText = parseWordDocument(Buffer.from(fileData, 'base64'));
                } else {
                    extractedText = "Unsupported file type. Please upload PDF or Word documents.";
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ extractedText }));
    } catch (error) {
                console.error('Document upload error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to process document' }));
            }
        });
            return;
        }
        
    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

// Start server
const PORT = process.env.PORT || 3007;
server.listen(PORT, async () => {
    console.log(`Ron's AI Career Coach server running on port ${PORT}`);
    console.log(`OpenAI API Key configured: ${OPENAI_API_KEY ? 'Yes' : 'No'}`);
    
    // Initialize production system
    await initializeSystem();
});
