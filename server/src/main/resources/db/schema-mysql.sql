-- 如页云同步后端的 MySQL 表结构（与 JPA 实体一致，utf8mb4 以支持全部中文与表情）
CREATE TABLE IF NOT EXISTS user_account (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME(6)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resume_document (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  owner_id   BIGINT       NOT NULL,
  client_id  VARCHAR(64)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  alias      VARCHAR(100) NULL,
  content    LONGTEXT     NOT NULL,
  version    BIGINT       NOT NULL,
  deleted    BIT          NOT NULL,
  updated_at DATETIME(6)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_resume_owner_client (owner_id, client_id),
  KEY idx_resume_owner (owner_id),
  CONSTRAINT fk_resume_owner FOREIGN KEY (owner_id) REFERENCES user_account (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
