package com.ruye.server.resume;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/**
 * 一份云端简历的历史版本：覆盖写入（或删除）前，把旧内容留一份。
 * 为了不让频繁的自动同步把历史挤满，同一份简历两次留档至少间隔 {@link ResumeService#REVISION_GAP}；删除前总是留档。
 * 只存 owner_id / document_id 两个数字，不建外键：注销账号、清理回收站时按 id 批量删除。
 */
@Entity
@Table(name = "resume_revision", indexes = {
        @Index(name = "idx_revision_document", columnList = "document_id, version"),
        @Index(name = "idx_revision_owner", columnList = "owner_id")})
public class ResumeRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private long ownerId;

    @Column(name = "document_id", nullable = false)
    private long documentId;

    /** 这份内容在云端时的版本号 */
    @Column(nullable = false)
    private long version;

    @Column(nullable = false, length = 200)
    private String title;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    /** 这份内容最后一次被写入的时间（即它成为「当前版本」的时间） */
    @Column(name = "saved_at", nullable = false)
    private Instant savedAt;

    protected ResumeRevision() {}

    static ResumeRevision of(ResumeDocument r) {
        ResumeRevision v = new ResumeRevision();
        v.ownerId = r.getOwner().getId();
        v.documentId = r.getId();
        v.version = r.getVersion();
        v.title = r.getTitle();
        v.content = r.getContent();
        v.savedAt = r.getUpdatedAt();
        return v;
    }

    public Long getId() { return id; }
    public long getDocumentId() { return documentId; }
    public long getVersion() { return version; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public Instant getSavedAt() { return savedAt; }
}
