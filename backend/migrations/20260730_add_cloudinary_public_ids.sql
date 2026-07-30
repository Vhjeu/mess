-- An toàn với dữ liệu cũ: chỉ thêm các cột nullable phục vụ xóa media Cloudinary.
-- Backend cũng kiểm tra và tự thêm các cột này khi khởi động.

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'attachments'
      AND column_name = 'file_public_id'
);
SET @statement = IF(
    @column_exists = 0,
    'ALTER TABLE attachments ADD COLUMN file_public_id VARCHAR(255) NULL',
    'SELECT 1'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'attachments'
      AND column_name = 'resource_type'
);
SET @statement = IF(
    @column_exists = 0,
    'ALTER TABLE attachments ADD COLUMN resource_type VARCHAR(20) NULL',
    'SELECT 1'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'avatar_public_id'
);
SET @statement = IF(
    @column_exists = 0,
    'ALTER TABLE users ADD COLUMN avatar_public_id VARCHAR(255) NULL',
    'SELECT 1'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
