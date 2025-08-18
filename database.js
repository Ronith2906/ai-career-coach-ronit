const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path - use in-memory for Heroku, file-based for local development
const dbPath = process.env.NODE_ENV === 'production' ? ':memory:' : path.join(__dirname, 'users.db');

// Global database instance for better performance
let globalDb = null;

// Initialize database with comprehensive error handling
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // If we already have a database connection, return it
        if (globalDb) {
            console.log('✅ Using existing database connection');
            resolve(globalDb);
            return;
        }

        console.log(`🔧 Initializing database with path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Connected to SQLite database');
            
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');
            
            // Create tables with comprehensive schema
            db.serialize(() => {
                // Users table with extended fields
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    phone TEXT,
                    location TEXT,
                    profession TEXT,
                    experience_level TEXT,
                    company TEXT,
                    linkedin_url TEXT,
                    website TEXT,
                    bio TEXT,
                    profile_picture TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME,
                    is_active BOOLEAN DEFAULT 1,
                    subscription_plan TEXT DEFAULT 'free',
                    subscription_expires DATETIME,
                    total_logins INTEGER DEFAULT 0,
                    last_activity DATETIME
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating users table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Users table ready');
                    }
                });

                // User resumes table with versioning
                db.run(`CREATE TABLE IF NOT EXISTS user_resumes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    resume_content TEXT NOT NULL,
                    resume_filename TEXT NOT NULL,
                    resume_title TEXT,
                    resume_version INTEGER DEFAULT 1,
                    job_title TEXT,
                    company_name TEXT,
                    is_current BOOLEAN DEFAULT 0,
                    tags TEXT,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
                    file_size INTEGER,
                    file_type TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating user_resumes table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ User resumes table ready');
                    }
                });

                // Chat history table with categorization
                db.run(`CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    response TEXT NOT NULL,
                    message_type TEXT DEFAULT 'general',
                    category TEXT DEFAULT 'career_advice',
                    tokens_used INTEGER,
                    response_time_ms INTEGER,
                    user_satisfaction INTEGER,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_id TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating chat_history table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Chat history table ready');
                    }
                });

                // Interview sessions table with detailed tracking
                db.run(`CREATE TABLE IF NOT EXISTS interview_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    job_title TEXT NOT NULL,
                    job_description TEXT,
                    company_name TEXT,
                    interview_type TEXT DEFAULT 'general',
                    difficulty_level TEXT DEFAULT 'medium',
                    questions TEXT NOT NULL,
                    answers TEXT,
                    feedback TEXT,
                    overall_score REAL,
                    strengths TEXT,
                    areas_for_improvement TEXT,
                    preparation_tips TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    duration_minutes INTEGER,
                    is_completed BOOLEAN DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating interview_sessions table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Interview sessions table ready');
                    }
                });

                // Resume analysis results table with comprehensive data
                db.run(`CREATE TABLE IF NOT EXISTS resume_analysis (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    resume_content TEXT NOT NULL,
                    job_description TEXT NOT NULL,
                    analysis_result TEXT NOT NULL,
                    generated_resume TEXT,
                    generated_cover_letter TEXT,
                    alignment_score REAL,
                    key_strengths TEXT,
                    areas_for_improvement TEXT,
                    missing_skills TEXT,
                    recommendations TEXT,
                    market_demand_score REAL,
                    salary_range TEXT,
                    industry_insights TEXT,
                    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    analysis_duration_ms INTEGER,
                    tokens_used INTEGER,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating resume_analysis table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Resume analysis table ready');
                    }
                });

                // Job applications tracking table
                db.run(`CREATE TABLE IF NOT EXISTS job_applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    job_title TEXT NOT NULL,
                    company_name TEXT NOT NULL,
                    job_description TEXT,
                    application_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'applied',
                    resume_used_id INTEGER,
                    cover_letter_id INTEGER,
                    application_url TEXT,
                    contact_person TEXT,
                    contact_email TEXT,
                    notes TEXT,
                    follow_up_date DATETIME,
                    interview_date DATETIME,
                    outcome TEXT,
                    salary_offered TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (resume_used_id) REFERENCES user_resumes (id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating job_applications table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ Job applications table ready');
                    }
                });

                // User preferences and settings table
                db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    notification_email BOOLEAN DEFAULT 1,
                    notification_sms BOOLEAN DEFAULT 0,
                    privacy_level TEXT DEFAULT 'standard',
                    data_sharing BOOLEAN DEFAULT 0,
                    theme_preference TEXT DEFAULT 'dark',
                    language TEXT DEFAULT 'en',
                    timezone TEXT DEFAULT 'UTC',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating user_preferences table:', err.message);
                        reject(err);
                        return;
                    } else {
                        console.log('✅ User preferences table ready');
                    }
                });

                // All tables created successfully
                console.log('✅ All database tables initialized successfully');
                
                // Store global reference
                globalDb = db;
                resolve(db);
            });
        });

        // Handle database errors
        db.on('error', (err) => {
            console.error('❌ Database error:', err.message);
            globalDb = null;
        });
    });
}

// Enhanced user creation with comprehensive data
async function createUser(email, password, name = '', additionalData = {}) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        // Validate required fields
        if (!email || !password || !name) {
            reject(new Error('Email, password, and name are required'));
            return;
        }

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
            
            try {
                // Hash password with enhanced security
                const saltRounds = 12;
                const passwordHash = await bcrypt.hash(password, saltRounds);
                
                // Prepare user data with defaults
                const userData = {
                    email: email,
                    password_hash: passwordHash,
                    name: name,
                    phone: additionalData.phone || null,
                    location: additionalData.location || null,
                    profession: additionalData.profession || null,
                    experience_level: additionalData.experience_level || 'entry',
                    company: additionalData.company || null,
                    linkedin_url: additionalData.linkedin_url || null,
                    website: additionalData.website || null,
                    bio: additionalData.bio || null,
                    profile_picture: additionalData.profile_picture || null
                };
                
                // Insert new user
                const columns = Object.keys(userData).join(', ');
                const placeholders = Object.keys(userData).map(() => '?').join(', ');
                const values = Object.values(userData);
                
                db.run(`INSERT INTO users (${columns}) VALUES (${placeholders})`, 
                    values, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            // Create default user preferences
                            db.run('INSERT INTO user_preferences (user_id) VALUES (?)', [this.lastID]);
                            
                            resolve({
                                id: this.lastID,
                                email: email,
                                name: name,
                                ...additionalData
                            });
                        }
                    });
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Enhanced user authentication with activity tracking
async function authenticateUser(email, password) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], async (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!row) {
                reject(new Error('User not found or account inactive'));
                return;
            }
            
            try {
                // Verify password
                const isValid = await bcrypt.compare(password, row.password_hash);
                if (!isValid) {
                    reject(new Error('Invalid password'));
                    return;
                }
                
                // Update user activity
                const updateData = {
                    last_login: new Date().toISOString(),
                    total_logins: row.total_logins + 1,
                    last_activity: new Date().toISOString()
                };
                
                db.run(`UPDATE users SET 
                    last_login = ?, 
                    total_logins = ?, 
                    last_activity = ? 
                    WHERE id = ?`, 
                    [updateData.last_login, updateData.total_logins, updateData.last_activity, row.id]);
                
                resolve({
                    id: row.id,
                    email: row.email,
                    name: row.name,
                    phone: row.phone,
                    location: row.location,
                    profession: row.profession,
                    experience_level: row.experience_level,
                    company: row.company,
                    linkedin_url: row.linkedin_url,
                    website: row.website,
                    bio: row.bio,
                    profile_picture: row.profile_picture,
                    subscription_plan: row.subscription_plan,
                    total_logins: updateData.total_logins
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Enhanced user profile retrieval
async function getUserById(userId) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.get(`SELECT 
            id, email, name, phone, location, profession, experience_level, 
            company, linkedin_url, website, bio, profile_picture, 
            created_at, last_login, total_logins, last_activity,
            subscription_plan, subscription_expires
            FROM users WHERE id = ? AND is_active = 1`, 
            [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error('User not found'));
                } else {
                    resolve(row);
                }
            });
    });
}

// Enhanced user profile update
async function updateUserProfile(userId, updateData) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        const allowedFields = [
            'name', 'phone', 'location', 'profession', 'experience_level',
            'company', 'linkedin_url', 'website', 'bio', 'profile_picture'
        ];
        
        const validUpdates = {};
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                validUpdates[field] = updateData[field];
            }
        });
        
        if (Object.keys(validUpdates).length === 0) {
            reject(new Error('No valid fields to update'));
            return;
        }
        
        const setClause = Object.keys(validUpdates).map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(validUpdates), userId];
        
        db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ success: true, updatedFields: Object.keys(validUpdates) });
            }
        });
    });
}

// Enhanced data storage functions with comprehensive tracking
async function saveUserResume(userId, resumeContent, filename, additionalData = {}) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        // Set current resume as inactive if this is a new version
        if (additionalData.is_current !== false) {
            db.run('UPDATE user_resumes SET is_current = 0 WHERE user_id = ?', [userId]);
        }
        
        const resumeData = {
            user_id: userId,
            resume_content: resumeContent,
            resume_filename: filename,
            resume_title: additionalData.resume_title || filename,
            resume_version: additionalData.resume_version || 1,
            job_title: additionalData.job_title || null,
            company_name: additionalData.company_name || null,
            is_current: additionalData.is_current !== false,
            tags: additionalData.tags ? JSON.stringify(additionalData.tags) : null,
            file_size: resumeContent.length,
            file_type: filename.split('.').pop() || 'txt'
        };
        
        const columns = Object.keys(resumeData).join(', ');
        const placeholders = Object.keys(resumeData).map(() => '?').join(', ');
        const values = Object.values(resumeData);
        
        db.run(`INSERT INTO user_resumes (${columns}) VALUES (${placeholders})`,
            values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

// Enhanced chat message storage with analytics
async function saveChatMessage(userId, message, response, additionalData = {}) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        const chatData = {
            user_id: userId,
            message: message,
            response: response,
            message_type: additionalData.message_type || 'general',
            category: additionalData.category || 'career_advice',
            tokens_used: additionalData.tokens_used || null,
            response_time_ms: additionalData.response_time_ms || null,
            user_satisfaction: additionalData.user_satisfaction || null,
            session_id: additionalData.session_id || null
        };
        
        const columns = Object.keys(chatData).join(', ');
        const placeholders = Object.keys(chatData).map(() => '?').join(', ');
        const values = Object.values(chatData);
        
        db.run(`INSERT INTO chat_history (${columns}) VALUES (${placeholders})`,
            values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

// Enhanced interview session storage
async function saveInterviewSession(userId, jobTitle, jobDescription, questions, answers, feedback, additionalData = {}) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        const sessionData = {
            user_id: userId,
            job_title: jobTitle,
            job_description: jobDescription,
            company_name: additionalData.company_name || null,
            interview_type: additionalData.interview_type || 'general',
            difficulty_level: additionalData.difficulty_level || 'medium',
            questions: JSON.stringify(questions),
            answers: answers ? JSON.stringify(answers) : null,
            feedback: feedback,
            overall_score: additionalData.overall_score || null,
            strengths: additionalData.strengths ? JSON.stringify(additionalData.strengths) : null,
            areas_for_improvement: additionalData.areas_for_improvement ? JSON.stringify(additionalData.areas_for_improvement) : null,
            preparation_tips: additionalData.preparation_tips || null,
            duration_minutes: additionalData.duration_minutes || null,
            is_completed: additionalData.is_completed || false
        };
        
        const columns = Object.keys(sessionData).join(', ');
        const placeholders = Object.keys(sessionData).map(() => '?').join(', ');
        const values = Object.values(sessionData);
        
        db.run(`INSERT INTO interview_sessions (${columns}) VALUES (${placeholders})`,
            values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

// Enhanced resume analysis storage
async function saveResumeAnalysis(userId, resumeContent, jobDescription, analysisResult, 
                                generatedResume, generatedCoverLetter, additionalData = {}) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        const analysisData = {
            user_id: userId,
            resume_content: resumeContent,
            job_description: jobDescription,
            analysis_result: analysisResult,
            generated_resume: generatedResume,
            generated_cover_letter: generatedCoverLetter,
            alignment_score: additionalData.alignment_score || null,
            key_strengths: additionalData.key_strengths ? JSON.stringify(additionalData.key_strengths) : null,
            areas_for_improvement: additionalData.areas_for_improvement ? JSON.stringify(additionalData.areas_for_improvement) : null,
            missing_skills: additionalData.missing_skills ? JSON.stringify(additionalData.missing_skills) : null,
            recommendations: additionalData.recommendations ? JSON.stringify(additionalData.recommendations) : null,
            market_demand_score: additionalData.market_demand_score || null,
            salary_range: additionalData.salary_range || null,
            industry_insights: additionalData.industry_insights || null,
            analysis_duration_ms: additionalData.analysis_duration_ms || null,
            tokens_used: additionalData.tokens_used || null
        };
        
        const columns = Object.keys(analysisData).join(', ');
        const placeholders = Object.keys(analysisData).map(() => '?').join(', ');
        const values = Object.values(analysisData);
        
        db.run(`INSERT INTO resume_analysis (${columns}) VALUES (${placeholders})`,
            values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

// Enhanced data retrieval functions
async function getUserResumes(userId, limit = 10) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM user_resumes 
                WHERE user_id = ? 
                ORDER BY is_current DESC, uploaded_at DESC 
                LIMIT ?`, 
            [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse JSON fields
                    rows.forEach(row => {
                        if (row.tags) {
                            try { row.tags = JSON.parse(row.tags); } catch (e) { row.tags = []; }
                        }
                    });
                    resolve(rows);
                }
            });
    });
}

async function getChatHistory(userId, limit = 50, category = null) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        let query = `SELECT * FROM chat_history WHERE user_id = ?`;
        let params = [userId];
        
        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }
        
        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);
        
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows.reverse()); // Return in chronological order
            }
        });
    });
}

async function getInterviewSessions(userId, limit = 20) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM interview_sessions 
                WHERE user_id = ? 
                ORDER BY started_at DESC 
                LIMIT ?`, 
            [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse JSON fields
                    rows.forEach(row => {
                        if (row.questions) {
                            try { row.questions = JSON.parse(row.questions); } catch (e) { row.questions = []; }
                        }
                        if (row.answers) {
                            try { row.answers = JSON.parse(row.answers); } catch (e) { row.answers = []; }
                        }
                        if (row.strengths) {
                            try { row.strengths = JSON.parse(row.strengths); } catch (e) { row.strengths = []; }
                        }
                        if (row.areas_for_improvement) {
                            try { row.areas_for_improvement = JSON.parse(row.areas_for_improvement); } catch (e) { row.areas_for_improvement = []; }
                        }
                    });
                    resolve(rows);
                }
            });
    });
}

async function getResumeAnalysisHistory(userId, limit = 20) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM resume_analysis 
                WHERE user_id = ? 
                ORDER BY analyzed_at DESC 
                LIMIT ?`, 
            [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse JSON fields
                    rows.forEach(row => {
                        if (row.key_strengths) {
                            try { row.key_strengths = JSON.parse(row.key_strengths); } catch (e) { row.key_strengths = []; }
                        }
                        if (row.areas_for_improvement) {
                            try { row.areas_for_improvement = JSON.parse(row.areas_for_improvement); } catch (e) { row.areas_for_improvement = []; }
                        }
                        if (row.missing_skills) {
                            try { row.missing_skills = JSON.parse(row.missing_skills); } catch (e) { row.missing_skills = []; }
                        }
                        if (row.recommendations) {
                            try { row.recommendations = JSON.parse(row.recommendations); } catch (e) { row.recommendations = []; }
                        }
                        if (row.industry_insights) {
                            try { row.industry_insights = JSON.parse(row.industry_insights); } catch (e) { row.industry_insights = []; }
                        }
                    });
                    resolve(rows);
                }
            });
    });
}

// New function to get user statistics
async function getUserStats(userId) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        db.get(`SELECT 
            (SELECT COUNT(*) FROM user_resumes WHERE user_id = ?) as total_resumes,
            (SELECT COUNT(*) FROM chat_history WHERE user_id = ?) as total_chats,
            (SELECT COUNT(*) FROM interview_sessions WHERE user_id = ?) as total_interviews,
            (SELECT COUNT(*) FROM resume_analysis WHERE user_id = ?) as total_analyses,
            (SELECT COUNT(*) FROM job_applications WHERE user_id = ?) as total_applications,
            (SELECT COUNT(*) FROM chat_history WHERE user_id = ? AND timestamp > datetime('now', '-7 days')) as chats_this_week,
            (SELECT COUNT(*) FROM interview_sessions WHERE user_id = ? AND started_at > datetime('now', '-30 days')) as interviews_this_month
        `, [userId, userId, userId, userId, userId, userId, userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// New function to update user preferences
async function updateUserPreferences(userId, preferences) {
    const db = await initializeDatabase();
    
    return new Promise((resolve, reject) => {
        const allowedFields = [
            'notification_email', 'notification_sms', 'privacy_level', 
            'data_sharing', 'theme_preference', 'language', 'timezone'
        ];
        
        const validUpdates = {};
        allowedFields.forEach(field => {
            if (preferences[field] !== undefined) {
                validUpdates[field] = preferences[field];
            }
        });
        
        if (Object.keys(validUpdates).length === 0) {
            reject(new Error('No valid preferences to update'));
            return;
        }
        
        const setClause = Object.keys(validUpdates).map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(validUpdates), new Date().toISOString(), userId];
        
        db.run(`UPDATE user_preferences SET ${setClause}, updated_at = ? WHERE user_id = ?`, 
            values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true, updatedPreferences: Object.keys(validUpdates) });
                }
            });
    });
}

// Export all functions
module.exports = {
    initializeDatabase,
    createUser,
    authenticateUser,
    getUserById,
    updateUserProfile,
    saveUserResume,
    saveChatMessage,
    saveInterviewSession,
    saveResumeAnalysis,
    getUserResumes,
    getChatHistory,
    getInterviewSessions,
    getResumeAnalysisHistory,
    getUserStats,
    updateUserPreferences
};
