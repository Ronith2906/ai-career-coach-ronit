const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path - use in-memory for Heroku, file-based for local development
const dbPath = process.env.NODE_ENV === 'production' ? ':memory:' : path.join(__dirname, 'users.db');

// Initialize database
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log(`🔧 Initializing database with path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Connected to SQLite database');
            
            // Create tables
            db.serialize(() => {
                // Users table
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating users table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Users table ready');
                    }

                // User resumes table
                db.run(`CREATE TABLE IF NOT EXISTS user_resumes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    resume_content TEXT NOT NULL,
                    resume_filename TEXT,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating user_resumes table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ User resumes table ready');
                    }
                });

                // Chat history table
                db.run(`CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    response TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating chat_history table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Chat history table ready');
                    }
                });

                // Interview sessions table
                db.run(`CREATE TABLE IF NOT EXISTS interview_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    job_title TEXT,
                    job_description TEXT,
                    questions TEXT,
                    answers TEXT,
                    feedback TEXT,
                    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating interview_sessions table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Interview sessions table ready');
                    }
                });

                // Resume analysis results table
                db.run(`CREATE TABLE IF NOT EXISTS resume_analysis (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    resume_content TEXT,
                    job_description TEXT,
                    analysis_result TEXT,
                    generated_resume TEXT,
                    generated_cover_letter TEXT,
                    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating resume_analysis table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Resume analysis table ready');
                    }
                });
                
                // All tables created successfully
                console.log('✅ All database tables initialized successfully');
                resolve(db);
            });
        });
    });
}
            });

            resolve(db);
        });
    });
}

// User authentication functions
async function createUser(email, password, name = '') {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        // Check if user already exists
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row) {
                reject(new Error('User already exists with this email'));
                return;
            }
            
            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
            // Insert new user
            db.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', 
                [email, passwordHash, name], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            email: email,
                            name: name
                        });
                    }
                });
        });
    });
}

async function authenticateUser(email, password) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!row) {
                reject(new Error('User not found'));
                return;
            }
            
            // Verify password
            const isValid = await bcrypt.compare(password, row.password_hash);
            if (!isValid) {
                reject(new Error('Invalid password'));
                return;
            }
            
            // Update last login
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
            
            resolve({
                id: row.id,
                email: row.email,
                name: row.name
            });
        });
    });
}

async function getUserById(userId) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.get('SELECT id, email, name, created_at, last_login FROM users WHERE id = ?', 
            [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
    });
}

// Data storage functions
async function saveUserResume(userId, resumeContent, filename) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO user_resumes (user_id, resume_content, resume_filename) VALUES (?, ?, ?)',
            [userId, resumeContent, filename], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

async function saveChatMessage(userId, message, response) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO chat_history (user_id, message, response) VALUES (?, ?, ?)',
            [userId, message, response], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

async function saveInterviewSession(userId, jobTitle, jobDescription, questions, answers, feedback) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO interview_sessions 
                (user_id, job_title, job_description, questions, answers, feedback) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, jobTitle, jobDescription, JSON.stringify(questions), 
             JSON.stringify(answers), feedback], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

async function saveResumeAnalysis(userId, resumeContent, jobDescription, analysisResult, 
                                generatedResume, generatedCoverLetter) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO resume_analysis 
                (user_id, resume_content, job_description, analysis_result, 
                 generated_resume, generated_cover_letter) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, resumeContent, jobDescription, analysisResult, 
             generatedResume, generatedCoverLetter], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

// Data retrieval functions
async function getUserResumes(userId) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM user_resumes WHERE user_id = ? ORDER BY uploaded_at DESC', 
            [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
    });
}

async function getChatHistory(userId, limit = 50) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?', 
            [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.reverse()); // Return in chronological order
                }
            });
    });
}

async function getInterviewSessions(userId) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY completed_at DESC', 
            [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
    });
}

async function getResumeAnalysisHistory(userId) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM resume_analysis WHERE user_id = ? ORDER BY analyzed_at DESC', 
            [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
    });
}

module.exports = {
    initializeDatabase,
    createUser,
    authenticateUser,
    getUserById,
    saveUserResume,
    saveChatMessage,
    saveInterviewSession,
    saveResumeAnalysis,
    getUserResumes,
    getChatHistory,
    getInterviewSessions,
    getResumeAnalysisHistory
};
