const http = require('http');
const fs = require('fs');
const path = require('path');

// Create HTTP server
const server = http.createServer((req, res) => {
    const url = req.url;
    
    // Add cache-busting headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Serve the main HTML file
    if (url === '/' || url === '/index.html') {
        fs.readFile('ai_career_coach_new.html', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading AI Career Coach');
                return;
            }
            res.writeHead(200, { 
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(data);
        });
        return;
    }
    
    // Handle static files (CSS, JS, images)
    if (url.endsWith('.css')) {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end('');
        return;
    }
    
    if (url.endsWith('.js')) {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('');
        return;
    }
    
    // Default response
    res.writeHead(200, { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    fs.readFile('ai_career_coach_new.html', (err, data) => {
        if (err) {
            res.end('AI Career Coach - Error loading page');
        } else {
            res.end(data);
        }
    });
});

// Start server on port 3008
const PORT = 3008;
server.listen(PORT, () => {
    console.log(`🚀 AI Career Coach server running on port ${PORT}`);
    console.log(`📱 Open your browser and go to: http://localhost:${PORT}`);
    console.log(`✨ This is the complete AI Career Coach with all features:`);
    console.log(`   - Resume Analysis & Generation`);
    console.log(`   - Cover Letter Generation`);
    console.log(`   - AI Chat`);
    console.log(`   - Interview Prep`);
    console.log(`   - Career Development`);
    console.log(`   - AI Job Matching`);
    console.log(`🔄 Cache-busting enabled - you should see the latest version!`);
});
