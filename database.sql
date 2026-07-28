
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(30) NOT NULL,
  display_name_updated_at DATETIME(6) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  email VARCHAR(254) DEFAULT NULL,
  email_verified_at DATETIME(6) DEFAULT NULL,
  pending_email VARCHAR(254) DEFAULT NULL,
  email_verification_code_hash CHAR(64) DEFAULT NULL,
  email_verification_expires_at DATETIME(6) DEFAULT NULL,
  email_verification_sent_at DATETIME(6) DEFAULT NULL,
  email_verification_window_started_at DATETIME(6) DEFAULT NULL,
  email_verification_send_count INT UNSIGNED NOT NULL DEFAULT 0,
  email_verification_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  password_reset_token_hash CHAR(64) DEFAULT NULL,
  password_reset_expires_at DATETIME(6) DEFAULT NULL,
  password_reset_sent_at DATETIME(6) DEFAULT NULL,
  password_reset_window_started_at DATETIME(6) DEFAULT NULL,
  password_reset_send_count INT UNSIGNED NOT NULL DEFAULT 0,
  password_reset_used_at DATETIME(6) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_pending_email (pending_email),
  KEY idx_users_password_reset_token (password_reset_token_hash)
);

CREATE TABLE user_nicknames (
  owner_user_id INT NOT NULL,
  target_user_id INT NOT NULL,
  nickname VARCHAR(30) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (owner_user_id, target_user_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_members (
  conversation_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cleared_through_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  hidden_at DATETIME(6) DEFAULT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT,
  has_attachment BOOLEAN DEFAULT FALSE,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) DEFAULT NULL,
  file_size BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE online_users (
  user_id INT NOT NULL,
  socket_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id, socket_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
