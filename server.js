const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
// Load environment variables - prioritize Heroku environment variables over local config
if (process.env.NODE_ENV === 'production') {
    // In production (Heroku), don't load local config file
    console.log('🚀 Production mode: Using Heroku environment variables');
} else {
    // In development, load local config file
    require('dotenv').config({ path: './config.env' });
    console.log('🔧 Development mode: Loaded local config.env');
}

// Document parsing libraries
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Rate limiting configuration
const RATE_LIMIT = {
    maxRequests: 10,
    windowMs: 60000,
    requests: new Map()
};

// Token counting function (more accurate estimation)
function estimateTokens(text) {
    // More accurate estimation: 1 token ≈ 3.2 characters for English text
    return Math.ceil(text.length / 3.2);
}

// Content truncation function to stay within token limits
function truncateContent(text, maxTokens, label = 'content') {
    if (estimateTokens(text) <= maxTokens) {
        return text;
    }
    
    // Start with a very conservative character limit
    let maxChars = Math.floor(maxTokens * 2.5);
    let truncated = text.substring(0, maxChars);
    
    // If still too long, reduce further more aggressively
    while (estimateTokens(truncated) > maxTokens && maxChars > 50) {
        maxChars = Math.floor(maxChars * 0.8);
        truncated = text.substring(0, maxChars);
    }
    
    console.log(`⚠️ ${label} truncated from ${estimateTokens(text)} tokens to ${estimateTokens(truncated)} tokens`);
    return truncated + '\n\n[Content truncated to fit within token limits]';
}

// Simple rate limiting middleware
function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    
    if (!RATE_LIMIT.requests.has(ip)) {
        RATE_LIMIT.requests.set(ip, []);
    }
    
    const userRequests = RATE_LIMIT.requests.get(ip);
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    RATE_LIMIT.requests.set(ip, validRequests);
    
    if (validRequests.length >= RATE_LIMIT.maxRequests) {
        return false;
    }
    
    validRequests.push(now);
    RATE_LIMIT.requests.set(ip, validRequests);
    return true;
}

// Clean up old rate limit data every 5 minutes
setInterval(() => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    
    for (const [ip, requests] of RATE_LIMIT.requests.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        if (validRequests.length === 0) {
            RATE_LIMIT.requests.delete(ip);
        } else {
            RATE_LIMIT.requests.set(ip, validRequests);
        }
    }
}, 300000);

const PORT = process.env.PORT || 3006;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

// Debug: Log API key status (without exposing the actual key)
if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key-here') {
    console.log('✅ OpenAI API key configured successfully');
    console.log(`🔑 Key starts with: ${OPENAI_API_KEY.substring(0, 7)}...`);
} else {
    console.log('❌ OpenAI API key not configured');
    console.log('🔍 Environment check:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   - OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
    console.log(`   - OPENAI_API_KEY length: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0}`);
}

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Performance optimizations
const CACHE_DURATION = 5 * 60 * 1000;
const responseCache = new Map();

function getCachedResponse(key) {
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCachedResponse(key, data) {
    responseCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const startTime = Date.now();
    const url = req.url;
    const method = req.method;
    
    console.log(`Request: ${method} ${url}`);
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=300');
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Parse URL
    const parsedUrl = new URL(url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;
    
    // Apply rate limiting to API requests
    if (pathname.startsWith('/api/')) {
        const clientIP = req.connection.remoteAddress || '127.0.0.1';
        if (!checkRateLimit(clientIP)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Too many requests. Please wait a moment and try again.',
                retryAfter: 60
            }));
            return;
        }
        handleApiRequest(req, res, pathname, parsedUrl);
        return;
    }
    
    // Handle static files
    if (pathname === '/' || pathname === '/index.html') {
        serveFile(res, './ai_career_coach.html', 'text/html');
        return;
    }
    
    // Serve other static files
    const filePath = path.join(__dirname, pathname);
    serveFile(res, filePath);
    
    // Log performance metrics
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
});

function handleApiRequest(req, res, pathname, parsedUrl) {
    res.setHeader('Content-Type', 'application/json');
    
    switch (pathname) {
        case '/api/upload-document':
            handleDocumentUpload(req, res);
            break;
        case '/api/update-resume':
            handleResumeUpdate(req, res);
            break;
        case '/api/generate-cover-letter':
            handleCoverLetterGeneration(req, res);
            break;
        case '/api/chat':
            handleChat(req, res);
            break;
        case '/api/job-analytics':
            handleJobAnalytics(req, res);
            break;
        case '/api/search-jobs':
            handleJobSearch(req, res);
            break;
        case '/api/career-development':
            handleCareerDevelopment(req, res);
            break;
        case '/api/interview-prep':
            handleInterviewPrep(req, res);
            break;
        case '/api/analyze-resume-with-jd':
            handleResumeAnalysisWithJD(req, res);
            break;
        case '/api/test-api':
            handleTestAPI(req, res);
            break;
        case '/api/motivational-message':
            handleMotivationalMessage(req, res);
            break;
        case '/api/generate-resume-and-cover-letter':
            handleGenerateResumeAndCoverLetter(req, res);
            break;
        default:
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }
}

// Helper function to make API calls with timeout
async function makeApiCall(options, postData = null) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 60000);
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                clearTimeout(timeout);
                try {
                    const jsonData = JSON.parse(data);
                    
                    // Check for OpenAI API errors
                    if (res.statusCode === 429) {
                        reject(new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.'));
                    } else if (res.statusCode === 400) {
                        const errorMsg = jsonData.error?.message || 'Bad request to OpenAI API';
                        reject(new Error(`OpenAI API error: ${errorMsg}`));
                    } else if (res.statusCode !== 200) {
                        reject(new Error(`OpenAI API error: ${res.statusCode} - ${jsonData.error?.message || 'Unknown error'}`));
                    } else if (jsonData.error) {
                        reject(new Error(`OpenAI API error: ${jsonData.error.message}`));
                    }
                    
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`Failed to parse OpenAI API response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

function handleDocumentUpload(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString('binary');
    });
    
    req.on('end', async () => {
        try {
            let content = '';
            let filename = 'uploaded_document';
            let fileType = 'unknown';
            
            // Parse multipart form data
            const boundary = body.split('\r\n')[0];
            if (!boundary) {
                throw new Error('No boundary found in multipart data');
            }
            
            const parts = body.split(boundary);
            let fileBuffer = null;
            
            for (const part of parts) {
                if (part.includes('Content-Type:') && part.includes('Content-Disposition:')) {
                    const lines = part.split('\r\n');
                    let contentType = '';
                    let contentDisposition = '';
                    
                    // Extract content type and disposition
                    for (const line of lines) {
                        if (line.startsWith('Content-Type:')) {
                            contentType = line.split(':')[1].trim();
                        }
                        if (line.startsWith('Content-Disposition:')) {
                            contentDisposition = line;
                        }
                    }
                    
                    // Find the start of file content
                    let contentStart = false;
                    let partContent = '';
                    
                    for (const line of lines) {
                        if (line === '') {
                            contentStart = true;
                            continue;
                        }
                        if (contentStart) {
                            partContent += line + '\r\n';
                        }
                    }
                    
                    // Remove the trailing boundary
                    partContent = partContent.replace(/--\r?\n?$/, '');
                    
                    if (partContent.trim()) {
                        // Convert to buffer for proper parsing
                        fileBuffer = Buffer.from(partContent, 'binary');
                        
                        // Parse based on file type
                        if (contentType.includes('application/pdf')) {
                            fileType = 'pdf';
                            console.log('📄 Processing PDF document...');
                            
                            try {
                                const pdfData = await pdfParse(fileBuffer);
                                content = pdfData.text;
                                console.log(`✅ PDF parsed successfully: ${content.length} characters extracted`);
                            } catch (pdfError) {
                                console.error('❌ PDF parsing failed:', pdfError.message);
                                // Fallback: try to extract text manually
                                content = extractTextFromBuffer(fileBuffer);
                            }
                            
                        } else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
                            fileType = 'docx';
                            console.log('📄 Processing Word document...');
                            
                            try {
                                const result = await mammoth.extractRawText({ buffer: fileBuffer });
                                content = result.value;
                                console.log(`✅ Word document parsed successfully: ${content.length} characters extracted`);
                            } catch (docxError) {
                                console.error('❌ Word document parsing failed:', docxError.message);
                                // Fallback: try to extract text manually
                                content = extractTextFromBuffer(fileBuffer);
                            }
                            
                        } else if (contentType.includes('text/plain')) {
                            fileType = 'txt';
                            console.log('📄 Processing text document...');
                            content = partContent;
                            console.log(`✅ Text document processed: ${content.length} characters`);
                            
                        } else {
                            console.log(`⚠️ Unknown file type: ${contentType}, attempting manual extraction...`);
                            content = extractTextFromBuffer(fileBuffer);
                        }
                    }
                }
            }
            
            // Clean and validate content
            if (content) {
                content = cleanDocumentContent(content);
                
                if (content.length < 10) {
                    throw new Error('Extracted content is too short or empty');
                }
            } else {
                throw new Error('Failed to extract content from document');
            }
            
            // Log success details
            console.log(`📄 Document upload successful:`);
            console.log(`   - File type: ${fileType}`);
            console.log(`   - Content length: ${content.length} characters`);
            console.log(`   - Content preview: ${content.substring(0, 200)}...`);
            
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Document uploaded and parsed successfully',
                content: content,
                filename: filename,
                fileType: fileType,
                timestamp: new Date().toISOString()
            }));
            
        } catch (error) {
            console.error('❌ Document upload error:', error);
            res.writeHead(400);
            res.end(JSON.stringify({ 
                error: 'Failed to process document upload',
                details: error.message 
            }));
        }
    });
}

// Helper function to extract text from buffer when parsing fails
function extractTextFromBuffer(buffer) {
    try {
        // Convert buffer to string and clean it
        let text = buffer.toString('utf8');
        
        // Remove null bytes and control characters
        text = text.replace(/\x00/g, '');
        text = text.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        
        // Try to find readable text patterns
        const lines = text.split('\n');
        const readableLines = [];
        
        for (const line of lines) {
            // Check if line contains readable text (at least 3 alphanumeric characters)
            if (/[a-zA-Z0-9]{3,}/.test(line)) {
                readableLines.push(line.trim());
            }
        }
        
        return readableLines.join('\n');
    } catch (error) {
        console.error('Buffer extraction failed:', error);
        return '';
    }
}

// Helper function to clean document content
function cleanDocumentContent(content) {
    if (!content) return '';
    
    return content
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove control characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remove multiple consecutive newlines
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        // Trim whitespace
        .trim();
}

async function handleResumeUpdate(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            const result = await optimizeResumeWithAI(data.resumeText, data.jobDescription);
            res.writeHead(200);
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Resume optimization error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to optimize resume with AI' }));
        }
    });
}

async function optimizeResumeWithAI(resumeText, jobDescription) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured');
    }

    // Truncate content to stay within token limits
    const maxResumeTokens = 2000;
    const maxJobDescTokens = 1000;
    
    resumeText = truncateContent(resumeText, maxResumeTokens, 'Resume for optimization');
    jobDescription = truncateContent(jobDescription, maxJobDescTokens, 'Job Description for optimization');
    
    console.log(`📊 Optimization token usage: Resume ~${estimateTokens(resumeText)} tokens, Job Description ~${estimateTokens(jobDescription)} tokens`);

    const prompt = `Optimize this resume for the following job description:

RESUME CONTENT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Please provide a comprehensive resume optimization that includes:

1. OPTIMIZED RESUME CONTENT
   - Rewrite the resume to better align with the job requirements
   - Use relevant keywords from the job description
   - Highlight transferable skills and experiences
   - Format with clear sections and bullet points

2. KEY IMPROVEMENTS MADE
   - List specific changes and why they were made
   - Highlight keyword optimization
   - Note any skills or experiences that were emphasized

3. ADDITIONAL RECOMMENDATIONS
   - Suggest skills to develop
   - Recommend certifications or training
   - Suggest networking opportunities

Format the response with clear headings, bullet points, and structured sections.`;

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    };

    const postData = JSON.stringify({
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert resume optimization specialist. Create optimized resumes that clearly align with job descriptions, using structured formatting with headings, bullet points, and clear sections. Always provide actionable recommendations.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 1500,
        temperature: 0.5
    });

    try {
        const result = await makeApiCall(options, postData);
        return {
            success: true,
            result: result.choices?.[0]?.message?.content || 'Resume optimization failed',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function handleCoverLetterGeneration(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            
            if (!data.jobDescription) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Job description is required' }));
                return;
            }

            const result = await generateCoverLetterWithAI(
                data.resumeText || '', 
                data.jobDescription, 
                data.jobTitle || '', 
                data.companyName || ''
            );
            res.writeHead(200);
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Cover letter generation error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

async function generateCoverLetterWithAI(resumeText, jobDescription, jobTitle, companyName) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured');
    }

    // Truncate content to stay within token limits
    const maxResumeTokens = 1500;
    const maxJobDescTokens = 800;
    
    resumeText = truncateContent(resumeText, maxResumeTokens, 'Resume for cover letter');
    jobDescription = truncateContent(jobDescription, maxJobDescTokens, 'Job Description for cover letter');
    
    console.log(`📊 Cover letter token usage: Resume ~${estimateTokens(resumeText)} tokens, Job Description ~${estimateTokens(jobDescription)} tokens`);

    const prompt = `Generate a professional cover letter based on this resume and job description:

RESUME CONTENT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

JOB TITLE: ${jobTitle || 'Position'}
COMPANY: ${companyName || 'Company'}

Please create a comprehensive cover letter that includes:

1. PROFESSIONAL COVER LETTER
   - Opening paragraph that captures attention
   - Body paragraphs highlighting relevant skills and experiences
   - Specific examples from the resume that match job requirements
   - Closing paragraph with call to action

2. KEY HIGHLIGHTS
   - List the main points emphasized in the cover letter
   - Note how skills align with job requirements
   - Highlight unique value proposition

Format the response with clear headings, bullet points, and structured sections.`;

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    };

    const postData = JSON.stringify({
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert cover letter writer. Create compelling, professional cover letters that clearly connect the candidate\'s experience to the job requirements. Use structured formatting with headings, bullet points, and clear sections.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 1200,
        temperature: 0.6
    });

    try {
        const result = await makeApiCall(options, postData);
        return {
            success: true,
            result: result.choices?.[0]?.message?.content || 'Cover letter generation failed',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function handleChat(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            
            if (!data.message) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Message is required' }));
                return;
            }

            const result = await generateAIResponse(data.message);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                result: result,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Chat error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

async function generateAIResponse(message) {
    try {
        const cacheKey = `chat_${message.substring(0, 100)}`;
        const cached = getCachedResponse(cacheKey);
        if (cached) {
            return cached;
        }

        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
            throw new Error('OpenAI API key not configured');
        }

        // Truncate message to prevent token overflow
        const truncatedMessage = truncateContent(message, 300);
        
        const prompt = `You are an expert AI Career Coach. The user asked: "${truncatedMessage}"

CRITICAL: Return ONLY valid JSON with this structure:
{
  "answer": "Direct answer - make it unique and fresh",
  "advice": {
    "mainPoints": ["Point 1", "Point 2"],
    "actionSteps": ["Step 1", "Step 2"],
    "examples": ["Example 1"]
  },
  "resources": {
    "tools": ["Tool 1"],
    "websites": ["Website 1"],
    "books": ["Book 1"]
  },
  "tips": ["Tip 1", "Tip 2"],
  "nextSteps": ["Next Step 1"]
}

Keep response focused, practical, and UNIQUE.`;

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        };

        const postData = JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert AI Career Coach. Provide comprehensive, structured, and actionable career advice. You MUST return ONLY valid JSON in the exact format specified. Never include text outside the JSON structure. CRITICAL: Always provide FRESH, UNIQUE responses. Never repeat previous answers. Vary your language, examples, and approach each time.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,
            temperature: 0.9
        });

        const result = await makeApiCall(options, postData);
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content received from OpenAI API');
        }
        
        // Try to parse JSON response
        try {
            const jsonData = JSON.parse(content);
            setCachedResponse(cacheKey, jsonData);
            return jsonData;
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Raw response:', content);
            throw new Error('Invalid JSON response from AI. Please try again.');
        }
    } catch (error) {
        console.error('AI chat error:', error);
        return `I apologize, but I encountered an error: ${error.message}. Please try again.`;
    }
}

async function handleJobAnalytics(req, res) {
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    try {
        const result = await getRealJobAnalytics();
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Job analytics error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
    }
}

async function getRealJobAnalytics() {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured');
    }

    const prompt = `Provide comprehensive, current job market analytics and insights.

IMPORTANT: Return ONLY a valid JSON object with this exact structure:

{
  "marketOverview": {
    "employmentTrends": ["Trend 1", "Trend 2", "Trend 3"],
    "growthIndustries": ["Industry 1", "Industry 2", "Industry 3"],
    "remoteWorkStats": {
      "percentage": "X%",
      "trend": "Increasing/Decreasing/Stable",
      "topRemoteRoles": ["Role 1", "Role 2", "Role 3"]
    }
  },
  "inDemandSkills": {
    "technical": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
    "soft": ["Soft Skill 1", "Soft Skill 2", "Soft Skill 3"],
    "emerging": ["Emerging Skill 1", "Emerging Skill 2"]
  },
  "salaryTrends": {
    "byRole": [
      {
        "role": "Role Name",
        "entryLevel": "$XX,XXX - $XX,XXX",
        "midLevel": "$XX,XXX - $XX,XXX",
        "senior": "$XX,XXX - $XX,XXX"
      }
    ],
    "geographicVariations": ["Variation 1", "Variation 2"],
    "experienceImpact": "Description of how experience affects salary"
  },
  "jobOpportunities": {
    "highGrowthSectors": ["Sector 1", "Sector 2", "Sector 3"],
    "remoteAvailability": "High/Medium/Low",
    "entryVsSenior": {
      "entryLevel": "Description",
      "senior": "Description"
    }
  },
  "careerAdvice": {
    "stayingCompetitive": ["Strategy 1", "Strategy 2", "Strategy 3"],
    "upskilling": ["Recommendation 1", "Recommendation 2"],
    "networking": ["Strategy 1", "Strategy 2", "Strategy 3"]
  }
}

Ensure the JSON is valid and properly formatted.`;

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    };

    const postData = JSON.stringify({
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert job market analyst. Provide comprehensive, current market insights. You MUST return ONLY valid JSON in the exact format specified. Never include text outside the JSON structure.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 1500,
        temperature: 0.6
    });

    try {
        const result = await makeApiCall(options, postData);
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content received from OpenAI API');
        }
        
        // Try to parse JSON response
        try {
            const jsonData = JSON.parse(content);
            return jsonData;
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Raw response:', content);
            throw new Error('Invalid JSON response from AI. Please try again.');
        }
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function handleJobSearch(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            
            if (!data.query) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Job query is required' }));
                return;
            }

            const result = await searchRealJobs(data.query, data.location);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                result: result,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Job search error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

async function searchRealJobs(query, location) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured');
    }

    const prompt = `Generate realistic job search results for the following query:

JOB SEARCH: ${query}
LOCATION: ${location || 'Any location'}

IMPORTANT: Return ONLY a valid JSON object with this exact structure:

{
  "jobListings": [
    {
      "id": "job_1",
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "salary": "$XX,XXX - $XX,XXX",
      "type": "Full-time/Part-time/Contract",
      "posted": "X days ago",
      "requirements": ["Requirement 1", "Requirement 2", "Requirement 3"],
      "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"],
      "benefits": ["Benefit 1", "Benefit 2"],
      "applicationDeadline": "MM/DD/YYYY"
    }
  ],
  "marketInsights": {
    "demand": "High/Medium/Low",
    "salaryRange": "$XX,XXX - $XX,XXX",
    "topSkills": ["Skill 1", "Skill 2", "Skill 3"],
    "growthTrend": "Growing/Stable/Declining"
  },
  "applicationTips": {
    "resumeKeywords": ["Keyword 1", "Keyword 2", "Keyword 3"],
    "standoutStrategies": ["Strategy 1", "Strategy 2"],
    "interviewPrep": ["Tip 1", "Tip 2", "Tip 3"]
  }
}

Generate 5-7 realistic job listings. Ensure the JSON is valid and properly formatted.`;

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    };

    const postData = JSON.stringify({
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert job search specialist. Generate realistic, relevant job listings. You MUST return ONLY valid JSON in the exact format specified. Never include text outside the JSON structure.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 1800,
        temperature: 0.6
    });

    try {
        const result = await makeApiCall(options, postData);
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content received from OpenAI API');
        }
        
        // Try to parse JSON response
        try {
            const jsonData = JSON.parse(content);
            return jsonData;
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Raw response:', content);
            throw new Error('Invalid JSON response from AI. Please try again.');
        }
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function handleCareerDevelopment(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            
            if (!data.userProfile || !data.goals) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'User profile and career goals are required' }));
                return;
            }

            const result = await generateCareerPlanWithAI(data.userProfile, data.goals);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                result: result,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Career development error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

async function generateCareerPlanWithAI(userProfile, goals) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured');
    }

    const prompt = `Create a comprehensive career development plan based on the following information:

User Profile:
${userProfile}

Career Goals:
${goals}

IMPORTANT: Return ONLY a valid JSON object with this exact structure:

{
  "skillsAssessment": {
    "currentSkills": ["Skill 1", "Skill 2", "Skill 3"],
    "missingSkills": ["Missing Skill 1", "Missing Skill 2"],
    "skillGaps": ["Gap 1", "Gap 2", "Gap 3"]
  },
  "goals": {
    "shortTerm": [
      {
        "title": "Goal Title",
        "description": "Goal description",
        "timeline": "3-6 months",
        "actionSteps": ["Step 1", "Step 2", "Step 3"],
        "successMetrics": ["Metric 1", "Metric 2"]
      }
    ],
    "mediumTerm": [
      {
        "title": "Goal Title",
        "description": "Goal description",
        "timeline": "6-12 months",
        "actionSteps": ["Step 1", "Step 2", "Step 3"],
        "successMetrics": ["Metric 1", "Metric 2"]
      }
    ],
    "longTerm": [
      {
        "title": "Goal Title",
        "description": "Goal description",
        "timeline": "1-3 years",
        "actionSteps": ["Step 1", "Step 2", "Step 3"],
        "successMetrics": ["Metric 1", "Metric 2"]
      }
    ]
  },
  "learningPath": {
    "certifications": ["Cert 1", "Cert 2", "Cert 3"],
    "courses": ["Course 1", "Course 2"],
    "resources": ["Resource 1", "Resource 2", "Resource 3"]
  },
  "networking": {
    "mentorship": ["Mentor Type 1", "Mentor Type 2"],
    "events": ["Event Type 1", "Event Type 2"],
    "platforms": ["Platform 1", "Platform 2"]
  }
}

Ensure the JSON is valid and properly formatted.`;

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    };

    const postData = JSON.stringify({
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert career development coach. Create comprehensive, actionable career plans. You MUST return ONLY valid JSON in the exact format specified. Never include text outside the JSON structure.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 1500,
        temperature: 0.7
    });

    try {
        const result = await makeApiCall(options, postData);
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content received from OpenAI API');
        }
        
        // Try to parse JSON response
        try {
            const jsonData = JSON.parse(content);
            return jsonData;
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Raw response:', content);
            throw new Error('Invalid JSON response from AI. Please try again.');
        }
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function handleInterviewPrep(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            
            if (!data.jobDescription) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Job description is required' }));
                return;
            }

            // Extract job title from description if not provided, or use default
            const jobTitle = data.jobTitle || extractJobTitleFromDescription(data.jobDescription) || 'Software Engineer';
            
            const result = await generateInterviewQuestionsWithAI(jobTitle, data.jobDescription);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                result: result,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Interview prep error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

// Helper function to extract job title from description
function extractJobTitleFromDescription(description) {
    // Common job titles to look for
    const commonTitles = [
        'Software Engineer', 'Software Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
        'DevOps Engineer', 'Data Scientist', 'Data Engineer', 'Product Manager', 'Project Manager',
        'UI/UX Designer', 'QA Engineer', 'System Administrator', 'Network Engineer', 'Security Engineer',
        'Machine Learning Engineer', 'AI Engineer', 'Cloud Engineer', 'Mobile Developer', 'Web Developer'
    ];
    
    const lowerDesc = description.toLowerCase();
    
    // Look for exact matches first
    for (const title of commonTitles) {
        if (lowerDesc.includes(title.toLowerCase())) {
            return title;
        }
    }
    
    // Look for partial matches
    for (const title of commonTitles) {
        const words = title.toLowerCase().split(' ');
        if (words.some(word => lowerDesc.includes(word))) {
            return title;
        }
    }
    
    // Default fallback
    return 'Software Engineer';
}

async function generateInterviewQuestionsWithAI(jobTitle, jobDescription) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured');
    }

    // Truncate content to prevent token overflow
    const truncatedJobDesc = truncateContent(jobDescription, 800);
    const truncatedJobTitle = truncateContent(jobTitle, 100);

    const prompt = `Generate interview questions for: ${truncatedJobTitle}

Job Description: ${truncatedJobDesc}

CRITICAL: Return ONLY valid JSON with this exact structure:
{
  "behavioralQuestions": [
    {
      "question": "Tell me about a time when you had to work with a difficult team member. How did you handle the situation?",
      "focus": "Teamwork and conflict resolution",
      "tip": "Use the STAR method: Situation, Task, Action, Result"
    }
  ],
  "technicalQuestions": [
    {
      "question": "What is your experience with JavaScript frameworks?",
      "focus": "Technical knowledge and hands-on experience",
      "tip": "Provide specific examples and mention versions you've used"
    }
  ],
  "situationalQuestions": [
    {
      "question": "How would you handle a project that is behind schedule?",
      "focus": "Project management and problem-solving",
      "tip": "Show your systematic approach and communication skills"
    }
  ],
  "generalTips": [
    "Research the company thoroughly before the interview",
    "Prepare specific examples from your experience",
    "Ask thoughtful questions about the role and company"
  ],
  "questionsToAsk": [
    {
      "question": "What does success look like for this role in the first 6 months?",
      "purpose": "Shows you're thinking about long-term contribution"
    }
  ]
}

Generate exactly 5 behavioral, 5 technical, and 3 situational questions. Return ONLY the JSON object.`;

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    };

    const postData = JSON.stringify({
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert interview preparation coach. You MUST return ONLY valid JSON in the exact format specified. Never include any text, explanations, or formatting outside the JSON structure. The response must start with { and end with }.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 800,
        temperature: 0.7
    });

    try {
        const result = await makeApiCall(options, postData);
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content received from OpenAI API');
        }
        
        // Try to parse JSON response
        try {
            const jsonData = JSON.parse(content);
            return jsonData;
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Raw response:', content);
            
            // Try to extract JSON from the response if it contains extra text
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const extractedJson = jsonMatch[0];
                    console.log('Attempting to parse extracted JSON:', extractedJson);
                    
                    // Try to fix common JSON issues
                    let fixedJson = extractedJson;
                    
                    // Fix trailing commas in arrays and objects
                    fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
                    
                    // Fix incomplete strings at the end
                    const lastQuoteIndex = fixedJson.lastIndexOf('"');
                    if (lastQuoteIndex !== -1) {
                        const afterLastQuote = fixedJson.substring(lastQuoteIndex + 1);
                        if (afterLastQuote.includes('"') === false) {
                            // Remove incomplete string at the end
                            fixedJson = fixedJson.substring(0, lastQuoteIndex + 1);
                        }
                    }
                    
                    // Fix incomplete questions that end abruptly
                    const incompleteQuestionMatch = fixedJson.match(/"question":\s*"([^"]*)$/);
                    if (incompleteQuestionMatch) {
                        // Remove the incomplete question
                        fixedJson = fixedJson.substring(0, incompleteQuestionMatch.index);
                        // Close the previous object properly
                        fixedJson = fixedJson.replace(/,\s*$/, '');
                        fixedJson += '}';
                    }
                    
                    // Fix incomplete array items
                    const incompleteArrayMatch = fixedJson.match(/"([^"]*)"\s*,\s*$/);
                    if (incompleteArrayMatch) {
                        fixedJson = fixedJson.substring(0, incompleteArrayMatch.index);
                        fixedJson += ']';
                    }
                    
                    // Try to close any unclosed brackets
                    const openBraces = (fixedJson.match(/\{/g) || []).length;
                    const closeBraces = (fixedJson.match(/\}/g) || []).length;
                    const openBrackets = (fixedJson.match(/\[/g) || []).length;
                    const closeBrackets = (fixedJson.match(/\]/g) || []).length;
                    
                    if (openBraces > closeBraces) {
                        fixedJson += '}'.repeat(openBraces - closeBraces);
                    }
                    if (openBrackets > closeBrackets) {
                        fixedJson += ']'.repeat(openBrackets - closeBrackets);
                    }
                    
                    console.log('Attempting to parse fixed JSON:', fixedJson);
                    const parsedJson = JSON.parse(fixedJson);
                    return parsedJson;
                }
            } catch (extractError) {
                console.error('Failed to extract and parse JSON:', extractError);
            }
            
            // If all parsing attempts fail, return a simple structured response
            console.log('⚠️ JSON parsing failed, returning fallback response');
            return {
                behavioralQuestions: [
                    {
                        question: "Tell me about a time when you had to work with a difficult team member. How did you handle the situation?",
                        focus: "Teamwork and conflict resolution",
                        tip: "Use the STAR method: Situation, Task, Action, Result"
                    },
                    {
                        question: "Describe a situation where you had to explain a complex technical concept to a non-technical audience.",
                        focus: "Communication Skills",
                        tip: "Explain how you made the concept understandable and the outcome"
                    }
                ],
                technicalQuestions: [
                    {
                        question: "What is your experience with the technologies mentioned in this role?",
                        focus: "Technical Expertise",
                        tip: "Provide specific examples from your experience"
                    },
                    {
                        question: "How do you stay updated with the latest industry trends and technologies?",
                        focus: "Continuous Learning",
                        tip: "Discuss your learning methods and resources"
                    }
                ],
                situationalQuestions: [
                    {
                        question: "How would you handle a project that is behind schedule?",
                        focus: "Project management and problem-solving",
                        tip: "Show your systematic approach and communication skills"
                    }
                ],
                generalTips: [
                    "Research the company thoroughly before the interview",
                    "Prepare specific examples from your experience",
                    "Ask thoughtful questions about the role and company"
                ],
                questionsToAsk: [
                    {
                        question: "What does success look like in this role?",
                        focus: "Role expectations"
                    },
                    {
                        question: "What are the biggest challenges facing the team?",
                        focus: "Team dynamics"
                    }
                ]
            };
        }
    } catch (error) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function handleResumeAnalysisWithJD(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const data = JSON.parse(body);

            if (!data.resumeContent || !data.jobDescription) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Resume content and job description are required' }));
                return;
            }

            const result = await analyzeResumeWithJobDescription(data.resumeContent, data.jobDescription);
            res.writeHead(200);
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Resume analysis with JD error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

async function analyzeResumeWithJobDescription(resumeContent, jobDescription) {
    try {
        const cacheKey = `analysis_${resumeContent.substring(0, 100)}_${jobDescription.substring(0, 100)}`;
        const cached = getCachedResponse(cacheKey);
        if (cached) {
            console.log('📋 Using cached analysis result');
            return { success: true, analysis: cached };
        }

        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
            throw new Error('OpenAI API key not configured');
        }

        // Check and truncate content to stay within token limits
        const maxResumeTokens = 1500;  // Very conservative to stay well under limits
        const maxJobDescTokens = 800;   // Very conservative to stay well under limits
        
        resumeContent = truncateContent(resumeContent, maxResumeTokens, 'Resume');
        jobDescription = truncateContent(jobDescription, maxJobDescTokens, 'Job Description');
        
        console.log(`📊 Token usage: Resume ~${estimateTokens(resumeContent)} tokens, Job Description ~${estimateTokens(jobDescription)} tokens`);
        console.log(`📄 Resume content preview: ${resumeContent.substring(0, 300)}...`);
        console.log(`📋 Job description preview: ${jobDescription.substring(0, 200)}...`);

        const prompt = `Analyze this resume content against the job description. Even if the resume content appears to have formatting issues or special characters (common with PDF conversions), extract what information you can and provide a meaningful analysis.

Resume Content:
${resumeContent}

Job Description:
${jobDescription}

IMPORTANT: Do your best to analyze the content regardless of formatting issues. Look for:
- Names, titles, skills, experience, education
- Any readable text that indicates qualifications
- Patterns that suggest professional background

IMPORTANT: Return ONLY a valid JSON object with this exact structure:

{
  "alignmentScore": {
    "score": 8,
    "explanation": "Brief explanation of the score"
  },
  "keyStrengths": [
    {
      "strength": "Strength description",
      "evidence": "Evidence from resume",
      "relevance": "How it relates to job"
    }
  ],
  "areasForImprovement": [
    {
      "area": "Area to improve",
      "currentLevel": "Current level",
      "targetLevel": "Target level",
      "action": "Action to take"
    }
  ],
  "keyDifferences": [
    {
      "missingSkill": "Missing skill/experience",
      "importance": "How important for the job",
      "howToAcquire": "How to acquire it"
    }
  ],
  "recommendations": [
    {
      "action": "Specific action",
      "priority": "High/Medium/Low",
      "timeline": "When to do it",
      "expectedOutcome": "Expected result"
    }
  ],
  "overallAssessment": "Overall assessment summary"
}

If the resume content is severely limited, focus on the job requirements and provide general guidance. Ensure the JSON is valid and properly formatted.`;

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        };

        const postData = JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert resume analyst. Your job is to analyze resume content regardless of formatting issues. Extract meaningful information from any readable text and provide structured analysis. You MUST return ONLY valid JSON in the exact format specified. Never refuse to analyze - always provide insights based on available information.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,  // Very conservative to stay well within token limits
            temperature: 0.5
        });

        console.log('🚀 Sending request to OpenAI API for resume analysis...');
        const data = await makeApiCall(options, postData);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenAI API');
        }
        
        const content = data.choices[0].message.content;
        console.log('✅ Resume analysis completed successfully');
        
        // Try to parse JSON response
        try {
            const jsonData = JSON.parse(content);
            // Cache the result
            setCachedResponse(cacheKey, jsonData);
            return { success: true, analysis: jsonData };
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Raw response:', content);
            throw new Error('Invalid JSON response from AI. Please try again.');
        }
    } catch (error) {
        console.error('❌ Resume analysis error:', error.message);
        
        // Provide user-friendly error messages
        if (error.message.includes('rate limit')) {
            return { 
                success: false, 
                error: 'OpenAI API is currently busy. Please wait a moment and try again. This usually resolves within 1-2 minutes.',
                retryAfter: 120
            };
        } else if (error.message.includes('400')) {
            return { 
                success: false, 
                error: 'The request format was invalid. Please check your resume and job description content.',
                details: error.message
            };
        } else if (error.message.includes('timeout')) {
            return { 
                success: false, 
                error: 'The request timed out. Please try again.',
                retryAfter: 30
            };
        } else {
            return { 
                success: false, 
                error: `Analysis failed: ${error.message}`,
                retryAfter: 60
            };
        }
    }
}

async function handleMotivationalMessage(req, res) {
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    try {
        const message = getMotivationalMessage();
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            message: message,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Motivational message error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to generate motivational message' }));
    }
}

async function handleTestAPI(req, res) {
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    try {
        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
            res.writeHead(500);
            res.end(JSON.stringify({ 
                success: false, 
                error: 'OpenAI API key not configured',
                message: 'Please check your config.env file'
            }));
            return;
        }

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        };

        const postData = JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'user',
                    content: 'Hello! Please respond with "API is working correctly" if you can see this message.'
                }
            ],
            max_tokens: 50,
            temperature: 0.1
        });

        console.log('🧪 Testing OpenAI API connection...');
        const data = await makeApiCall(options, postData);
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            res.writeHead(200);
            res.end(JSON.stringify({ 
                success: true, 
                message: 'OpenAI API is working correctly',
                response: data.choices[0].message.content,
                model: data.model,
                usage: data.usage
            }));
        } else {
            throw new Error('Invalid response format from OpenAI API');
        }
    } catch (error) {
        console.error('❌ API test failed:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            success: false, 
            error: error.message,
            message: 'OpenAI API test failed. Check your API key and internet connection.'
        }));
    }
}

async function handleGenerateResumeAndCoverLetter(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const data = JSON.parse(body);

            if (!data.resumeContent || !data.jobDescription) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Resume content and job description are required' }));
                return;
            }

            const result = await generateResumeAndCoverLetterWithAI(data.resumeContent, data.jobDescription);
            res.writeHead(200);
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Resume and cover letter generation error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

async function generateResumeAndCoverLetterWithAI(resumeText, jobDescription) {
    try {
        // Increase token limits for this combined generation request
        const maxResumeTokens = 3000; // Increased from 1500
        const maxJobDescTokens = 1200; // Increased from 800
        const maxTotalTokens = 4000; // Increased total limit
        
        // Truncate content to fit within token limits
        const truncatedResume = truncateContent(resumeText, maxResumeTokens, 'resume');
        const truncatedJobDesc = truncateContent(jobDescription, maxJobDescTokens, 'job description');
        
        console.log(`📊 Token usage for generation: Resume: ${estimateTokens(truncatedResume)}, JD: ${estimateTokens(truncatedJobDesc)}`);
        
        const prompt = `MODIFY the existing resume and create a cover letter based on the following resume content and job description.

EXISTING RESUME CONTENT:
${truncatedResume}

JOB DESCRIPTION:
${truncatedJobDesc}

IMPORTANT INSTRUCTIONS:
1. MODIFY the existing resume to better match the job requirements
2. Keep all the user's original information (name, contact, experience, education)
3. Update the summary, skills, and experience descriptions to align with the job
4. Reorganize and enhance content to highlight relevant qualifications
5. Use action verbs and quantifiable achievements
6. Ensure ATS-friendly formatting

**Modified Professional Resume**
[Take the existing resume and modify it to better match the job requirements. Keep all original information but update descriptions, skills, and summary to align with the job. Use clear sections: Contact, Summary, Experience, Skills, Education.]

**Cover Letter**
[Create a compelling cover letter that explains why you're a perfect fit for this specific role. Reference specific skills and experiences from your modified resume. Show enthusiasm for the role and company. Keep it concise but impactful (3-4 paragraphs).]

Make both documents ready for immediate use in job applications. The resume should be an enhanced version of the original, not a generic template.`;

        const options = {
            method: 'POST',
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const postData = JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert resume writer and career coach. Create professional, tailored resumes and cover letters that match job requirements perfectly. Always provide well-structured, ready-to-use documents.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 2500, // Increased from 1200 for combined generation
            temperature: 0.7
        });

        const response = await makeApiCall(options, postData);

        if (response && response.choices && response.choices[0]) {
            const content = response.choices[0].message.content;
            
            // Parse the response to separate resume and cover letter
            let resume = '';
            let coverLetter = '';
            
            // Look for clear section separators
            const resumeMatch = content.match(/\*\*.*?Resume.*?\*\*([\s\S]*?)(?=\*\*.*?Cover Letter|\*\*.*?Professional Cover Letter|$)/i);
            const coverLetterMatch = content.match(/\*\*.*?Cover Letter.*?\*\*([\s\S]*?)(?=\*\*.*?Resume|\*\*.*?Professional Resume|$)/i);
            
            if (resumeMatch && coverLetterMatch) {
                // Both sections found
                resume = resumeMatch[1].trim();
                coverLetter = coverLetterMatch[1].trim();
            } else if (resumeMatch) {
                // Only resume found, try to split content
                resume = resumeMatch[1].trim();
                const remainingContent = content.replace(resumeMatch[0], '').trim();
                if (remainingContent.includes('Cover Letter') || remainingContent.includes('cover letter')) {
                    coverLetter = remainingContent;
                } else {
                    coverLetter = 'Cover letter content not found in the response.';
                }
            } else if (coverLetterMatch) {
                // Only cover letter found, try to split content
                coverLetter = coverLetterMatch[1].trim();
                const remainingContent = content.replace(coverLetterMatch[0], '').trim();
                if (remainingContent.includes('Resume') || remainingContent.includes('resume')) {
                    resume = remainingContent;
                } else {
                    resume = 'Resume content not found in the response.';
                }
            } else {
                // Try to split by common patterns
                const parts = content.split(/(?=Cover Letter|Professional Cover Letter|Resume|Professional Resume)/i);
                if (parts.length >= 2) {
                    resume = parts[0].trim();
                    coverLetter = parts.slice(1).join(' ').trim();
                } else {
                    // Fallback: split content in half
                    const midPoint = Math.floor(content.length / 2);
                    resume = content.substring(0, midPoint).trim();
                    coverLetter = content.substring(midPoint).trim();
                }
            }
            
            return {
                success: true,
                resume: resume,
                coverLetter: coverLetter,
                result: content
            };
        } else {
            throw new Error('Invalid response format from OpenAI API');
        }
    } catch (error) {
        console.error('❌ Resume and cover letter generation error:', error);
        throw error;
    }
}

// Generate motivational message for the day
function getMotivationalMessage() {
    const messages = [
        "🚀 Your career journey is unique - embrace every challenge as a stepping stone to success!",
        "💪 Remember: every expert was once a beginner. Keep pushing forward!",
        "🌟 Success is not final, failure is not fatal - it's the courage to continue that counts!",
        "🎯 Focus on progress, not perfection. Every step forward is a victory!",
        "🔥 Your potential is limitless. Believe in yourself and take action today!",
        "⚡ The only way to do great work is to love what you do. Find your passion!",
        "🌈 Every setback is a setup for a comeback. Stay resilient!",
        "🎉 Celebrate your small wins - they're building blocks to your big dreams!",
        "🚀 Don't wait for opportunity - create it! Your future is in your hands!",
        "💎 You are capable of amazing things. Trust the process and keep going!"
    ];
    
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    return messages[dayOfYear % messages.length];
}

// Helper function to serve files
function serveFile(res, filePath, contentType = null) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Internal server error');
            }
            return;
        }
        
        const ext = path.extname(filePath);
        const mimeType = contentType || mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Performance-optimized server running at http://localhost:${PORT}/`);
    console.log(`📱 Open your browser and navigate to: http://localhost:${PORT}/`);
    console.log('⏹️  Press Ctrl+C to stop the server');
    console.log('\n⚡ Performance Features Enabled:');
    console.log('   - Response caching (5 minutes)');
    console.log('   - Optimized API timeouts');
    console.log('   - CORS optimization');
    console.log('   - Performance monitoring');
    console.log('\n🔑 IMPORTANT: Configure your OpenAI API key in config.env');
    console.log('   - OPENAI_API_KEY: For all AI-powered features');
    console.log('   - Get your key from: https://platform.openai.com/api-keys');
    console.log('   - Cost: Very affordable (~$5-20/month for regular use)');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
});
