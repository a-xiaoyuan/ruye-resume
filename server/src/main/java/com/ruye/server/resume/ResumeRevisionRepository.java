package com.ruye.server.resume;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResumeRevisionRepository extends JpaRepository<ResumeRevision, Long> {

    @Query("select v from ResumeRevision v where v.documentId = :documentId order by v.version desc")
    List<ResumeRevision> findAllByDocument(@Param("documentId") long documentId);

    @Query("select v from ResumeRevision v where v.documentId = :documentId and v.version = :version")
    Optional<ResumeRevision> findOne(@Param("documentId") long documentId, @Param("version") long version);

    @Query("select max(v.savedAt) from ResumeRevision v where v.documentId = :documentId")
    Optional<Instant> latestSavedAt(@Param("documentId") long documentId);

    @Modifying
    @Query("delete from ResumeRevision v where v.ownerId = :ownerId")
    int deleteAllByOwner(@Param("ownerId") long ownerId);

    /** 回收站里超过保留期的简历，连同它的历史一起清除 */
    @Modifying
    @Query("delete from ResumeRevision v where v.documentId in (select r.id from ResumeDocument r where r.deleted = true and r.updatedAt < :before)")
    int purgeForDeleted(@Param("before") Instant before);
}
