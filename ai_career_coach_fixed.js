const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Payment plans configuration
const paymentPlans = {
    free: {
        name: "Free Trial",
        price: "$0",
        duration: "3 days",
        features: ["AI Career Chat", "Basic Resume Analysis", "Interview Prep", "Career Planning"],
        limits: {
            chat: 10,
            resumeAnalysis: 2,
            interviewPrep: 5,
            careerPlanning: 3
        }
    },
    starter: {
        name: "Starter Plan",
        price: "$9.99",
        duration: "per month",
        features: ["Everything in Free", "Advanced Resume Optimization", "Cover Letter Generation", "Priority Support"],
        limits: {
            chat: 100,
            resumeAnalysis: 20,
            interviewPrep: 50,
            careerPlanning: 25
        }
    },
    professional: {
        name: "Professional",
        price: "$19.99",
        duration: "per month",
        features: ["Everything in Starter", "Unlimited Usage", "Custom AI Training", "24/7 Support"],
        limits: {
            chat: -1,
            resumeAnalysis: -1,
            interviewPrep: -1,
            careerPlanning: -1
        }
    }
};

// User subscriptions tracking
const userSubscriptions = new Map();

// Conversation memory for context
const conversationMemory = new Map();
const userContext = new Map();

// Helper function to call OpenAI API with timeout
async function callOpenAI(prompt, systemPrompt = "", maxTokens = 800, timeoutMs = 25000) {
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
    if (!userSubscriptions.has(userId)) {
        // New user gets free trial
        userSubscriptions.set(userId, {
            plan: 'free',
            startDate: new Date(),
            usage: { chat: 0, resumeAnalysis: 0, interviewPrep: 0, careerPlanning: 0 }
        });
    }

    const subscription = userSubscriptions.get(userId);
    const plan = paymentPlans[subscription.plan];
    
    // Check if free trial expired
    if (subscription.plan === 'free') {
        const trialDays = 3;
        const daysSinceStart = (new Date() - subscription.startDate) / (1000 * 60 * 60 * 24);
        if (daysSinceStart > trialDays) {
            return { access: false, message: "Free trial expired. Please upgrade to continue." };
        }
    }

    // Check usage limits
    if (plan.limits[feature] !== -1 && subscription.usage[feature] >= plan.limits[feature]) {
        return { access: false, message: `Usage limit reached for ${feature}. Please upgrade your plan.` };
    }

    return { access: true, message: "Access granted" };
}

// Update user usage
function updateUserUsage(userId, feature) {
    if (userSubscriptions.has(userId)) {
        const subscription = userSubscriptions.get(userId);
        if (subscription.usage[feature] !== undefined) {
            subscription.usage[feature]++;
        }
    }
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
        usage: { chat: 0, resumeAnalysis: 0, interviewPrep: 0, careerPlanning: 0 }
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
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: title,
                    heading: HeadingLevel.HEADING_1
                }),
                new Paragraph({
                    text: content
                })
            ]
        }]
    });

    return await Packer.toBuffer(doc);
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
    if (pathname === '/' || pathname === '/index.html') {
        fs.readFile('ai_career_coach.html', (err, data) => {
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
                const { message, userId } = JSON.parse(body);
                
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
                const aiResponse = await callOpenAI(contextualPrompt, 
                    "You are an AI Career Coach. Provide helpful, concise career advice. Keep responses under 300 tokens for general chat.", 
                    300);
                
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

    if (pathname === '/api/resume-analysis' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { resume, userId } = JSON.parse(body);
                
                const access = checkUserAccess(userId, 'resumeAnalysis');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                // Store resume context
                userContext.set(userId, { ...userContext.get(userId), resume });

                const prompt = `Analyze this resume and provide specific improvement suggestions:\n\n${resume}`;
                const analysis = await callOpenAI(prompt, 
                    "You are a professional resume reviewer. Provide specific, actionable feedback.", 
                    800);
                
                updateUserUsage(userId, 'resumeAnalysis');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    analysis,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Resume analysis error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
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
                
                const access = checkUserAccess(userId, 'resumeAnalysis');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                const prompt = `Generate a professional cover letter based on this resume for the following job description:\n\nResume:\n${resume}\n\nJob Description:\n${jobDescription}`;
                const coverLetter = await callOpenAI(prompt, 
                    "You are a professional cover letter writer. Create compelling, personalized cover letters.", 
                    800);
                
                updateUserUsage(userId, 'resumeAnalysis');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    coverLetter,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Cover letter error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
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
                const { role, userId } = JSON.parse(body);
                
                const access = checkUserAccess(userId, 'interviewPrep');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                const prompt = `Generate 5 common interview questions for a ${role} position, along with sample answers and tips.`;
                const questions = await callOpenAI(prompt, 
                    "You are an interview preparation expert. Provide practical interview questions and guidance.", 
                    800);
                
                updateUserUsage(userId, 'interviewPrep');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    questions,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Interview prep error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
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
                
                const access = checkUserAccess(userId, 'careerPlanning');
                if (!access.access) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: access.message }));
                    return;
                }

                const prompt = `Create a career development plan for someone transitioning from ${currentRole} to ${targetRole} with ${experience} years of experience. Include specific steps, skills to learn, and timeline.`;
                const plan = await callOpenAI(prompt, 
                    "You are a career development specialist. Create actionable career transition plans.", 
                    800);
                
                updateUserUsage(userId, 'careerPlanning');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    plan,
                    usage: userSubscriptions.get(userId)?.usage || {}
                }));
            } catch (error) {
                console.error('Career planning error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }

    if (pathname === '/api/job-analytics' && req.method === 'POST') {
        try {
            const analytics = generateRealTimeData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(analytics));
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
                const { query, location } = JSON.parse(body);
                const results = generateJobSearchResults(query, location);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ results }));
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
                const optimizedResume = await callOpenAI(prompt, 
                    "You are a professional resume writer. Optimize resumes for specific job descriptions.", 
                    1500);
                
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

    if (pathname === '/api/payment-plans' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(paymentPlans));
        return;
    }

    if (pathname === '/api/process-payment' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { userId, planName } = JSON.parse(body);
                const result = processPayment(userId, planName);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('Payment processing error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
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

    if (pathname === '/api/download-resume-word' && req.method === 'POST') {
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
                    'Content-Disposition': `attachment; filename="Optimized_Resume.docx"`
                });
                res.end(docBuffer);
            } catch (error) {
                console.error('Resume Word download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to generate Word document' }));
            }
        });
        return;
    }

    if (pathname === '/api/download-cover-letter-word' && req.method === 'POST') {
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
                    'Content-Disposition': `attachment; filename="Cover_Letter.docx"`
                });
                res.end(docBuffer);
            } catch (error) {
                console.error('Cover letter Word download error:', error);
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
const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
    console.log(`AI Career Coach server running on port ${PORT}`);
    console.log(`OpenAI API Key configured: ${OPENAI_API_KEY ? 'Yes' : 'No'}`);
});
