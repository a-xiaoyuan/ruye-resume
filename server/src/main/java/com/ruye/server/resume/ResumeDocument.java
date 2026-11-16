package com.ruye.server.resume;

import java.time.Instant;

import com.ruye.server.auth.UserAccount;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 云端保存的一份简历。content 是前端文档模型（RuyeDocument）的原样 JSON，后端不解析业务字段，
 * 只抽出标题和备注名用于列表显示。version 每次写入加一，用于多设备之间的乐观锁。
 * 删除是软删除（deleted = true），内容保留，避免误删后无法找回。
 */
@Entity
@Table(name = "resume_document",
        uniqueConstraints = @UniqueConstraint(name = "uk_resume_owner_client", columnNames = {"owner_id", "client_id"}),
        indexes = @Index(name = "idx_resume_owner", columnList = "owner_id"))
public class ResumeDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private UserAccount owner;

    /** 前端生成的文档 id（doc-xxxx），同一账号内唯一 */
    @Column(name = "client_id", nullable = false, length = 64)
    private String clientId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 100)
    private String alias;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    @Column(nullable = false)
    private long version;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ResumeDocument() {}

    public ResumeDocument(UserAccount owner, String clientId) {
        this.owner = owner;
        this.clientId = clientId;
        this.version = 0;
    }

    /** 写入新内容，版本号加一 */
    public void write(String title, String alias, String content) {
        this.title = title;
        this.alias = alias;
        this.content = content;
        this.deleted = false;
        this.version += 1;
        this.updatedAt = Instant.now();
    }

    public void markDeleted() {
        this.deleted = true;
        this.version += 1;
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public UserAccount getOwner() { return owner; }
    public String getClientId() { return clientId; }
    public String getTitle() { return title; }
    public String getAlias() { return alias; }
    public String getContent() { return content; }
    public long getVersion() { return version; }
    public boolean isDeleted() { return deleted; }
    public Instant getUpdatedAt() { return updatedAt; }
}
