-- Remove the restrictive file_type constraint
-- File type validation will be handled in application code

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;
