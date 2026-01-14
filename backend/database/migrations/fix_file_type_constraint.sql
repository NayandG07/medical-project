-- Fix file_type constraint to allow proper MIME types
-- This constraint was blocking uploads with application/pdf

-- Step 1: Check what file_types currently exist
-- SELECT DISTINCT file_type FROM documents;

-- Step 2: Update any invalid file_types to NULL or valid values
-- Update any rows that might have invalid file_type values
UPDATE documents 
SET file_type = CASE 
    WHEN file_type LIKE '%pdf%' THEN 'application/pdf'
    WHEN file_type LIKE '%jpeg%' OR file_type LIKE '%jpg%' THEN 'image/jpeg'
    WHEN file_type LIKE '%png%' THEN 'image/png'
    WHEN file_type LIKE '%gif%' THEN 'image/gif'
    WHEN file_type LIKE '%webp%' THEN 'image/webp'
    ELSE NULL
END
WHERE file_type IS NOT NULL 
AND file_type NOT IN (
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);

-- Step 3: Drop the existing constraint if it exists
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;

-- Step 4: Add a new constraint that allows common document MIME types
ALTER TABLE documents ADD CONSTRAINT documents_file_type_check 
CHECK (
    file_type IN (
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) OR file_type IS NULL
);

-- Add comment
COMMENT ON CONSTRAINT documents_file_type_check ON documents IS 'Allows common document and image MIME types';
