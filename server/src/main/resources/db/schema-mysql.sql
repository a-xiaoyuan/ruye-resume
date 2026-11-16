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

-- 云端简历的历史版本（覆盖或删除前留档；同一份简历两次留档至少间隔 10 分钟，最多保留 50 个）
CREATE TABLE IF NOT EXISTS resume_revision (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  owner_id    BIGINT       NOT NULL,
  document_id BIGINT       NOT NULL,
  version     BIGINT       NOT NULL,
  title       VARCHAR(200) NOT NULL,
  content     LONGTEXT     NOT NULL,
  saved_at    DATETIME(6)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_revision_document (document_id, version),
  KEY idx_revision_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
