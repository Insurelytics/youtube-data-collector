#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data.sqlite');

console.log('Starting cleanup of topics with "insta" in their names...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

// Run the cleanup in a transaction
db.serialize(() => {
    console.log('Starting transaction...');
    
    db.run('BEGIN TRANSACTION');
    
    // First, get a count of what we're about to delete
    db.get(`
        SELECT COUNT(*) as topic_count 
        FROM topics 
        WHERE name LIKE '%insta%'
    `, (err, row) => {
        if (err) {
            console.error('Error counting topics:', err.message);
            db.run('ROLLBACK');
            return;
        }
        console.log(`Found ${row.topic_count} topics with "insta" in their names.`);
    });
    
    db.get(`
        SELECT COUNT(*) as connection_count 
        FROM video_topics vt 
        JOIN topics t ON vt.topic_id = t.id 
        WHERE t.name LIKE '%insta%'
    `, (err, row) => {
        if (err) {
            console.error('Error counting connections:', err.message);
            db.run('ROLLBACK');
            return;
        }
        console.log(`Found ${row.connection_count} video-topic connections to remove.`);
    });
    
    // Delete video_topics connections first (to maintain foreign key integrity)
    db.run(`
        DELETE FROM video_topics 
        WHERE topic_id IN (
            SELECT id FROM topics WHERE name LIKE '%insta%'
        )
    `, function(err) {
        if (err) {
            console.error('Error deleting video_topics connections:', err.message);
            db.run('ROLLBACK');
            return;
        }
        console.log(`Deleted ${this.changes} video-topic connections.`);
        
        // Now delete the topics themselves
        db.run(`
            DELETE FROM topics 
            WHERE name LIKE '%insta%'
        `, function(err) {
            if (err) {
                console.error('Error deleting topics:', err.message);
                db.run('ROLLBACK');
                return;
            }
            console.log(`Deleted ${this.changes} topics.`);
            
            // Commit the transaction
            db.run('COMMIT', (err) => {
                if (err) {
                    console.error('Error committing transaction:', err.message);
                    return;
                }
                console.log('Transaction committed successfully!');
                console.log('Cleanup completed.');
                
                // Close the database
                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('Database connection closed.');
                    }
                });
            });
        });
    });
});
