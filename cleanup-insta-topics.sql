-- Cleanup script to remove topics with "insta" in their names and their connections

-- Show what we're about to delete
.print "Topics to be deleted:"
SELECT id, name FROM topics WHERE name LIKE '%insta%' ORDER BY name;

.print ""
.print "Video-topic connections to be deleted:"
SELECT COUNT(*) as connection_count 
FROM video_topics vt 
JOIN topics t ON vt.topic_id = t.id 
WHERE t.name LIKE '%insta%';

.print ""
.print "Starting cleanup..."

-- Begin transaction
BEGIN TRANSACTION;

-- Delete video_topics connections first (to maintain foreign key integrity)
DELETE FROM video_topics 
WHERE topic_id IN (
    SELECT id FROM topics WHERE name LIKE '%insta%'
);

-- Show how many connections were deleted
.print "Video-topic connections deleted: " || changes();

-- Delete the topics themselves
DELETE FROM topics 
WHERE name LIKE '%insta%';

-- Show how many topics were deleted
.print "Topics deleted: " || changes();

-- Commit the transaction
COMMIT;

.print ""
.print "Cleanup completed successfully!"

-- Verify the cleanup
.print ""
.print "Verification - topics with 'insta' remaining (should be 0):"
SELECT COUNT(*) as remaining_insta_topics FROM topics WHERE name LIKE '%insta%';
