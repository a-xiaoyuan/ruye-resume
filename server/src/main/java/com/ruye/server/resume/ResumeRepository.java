package com.ruye.server.resume;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ResumeRepository extends JpaRepository<ResumeDocument, Long> {

    @Query("select r from ResumeDocument r where r.owner.id = :ownerId order by r.updatedAt desc")
    List<ResumeDocument> findAllByOwner(@Param("ownerId") long ownerId);

    @Query("select r from ResumeDocument r where r.owner.id = :ownerId and r.clientId = :clientId")
    Optional<ResumeDocument> findOne(@Param("ownerId") long ownerId, @Param("clientId") String clientId);

    /** 写入前加行锁：同一份简历的并发写入排队执行，版本号比较才可靠 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ResumeDocument r where r.owner.id = :ownerId and r.clientId = :clientId")
    Optional<ResumeDocument> findOneForUpdate(@Param("ownerId") long ownerId, @Param("clientId") String clientId);

    @Query("select count(r) from ResumeDocument r where r.owner.id = :ownerId and r.deleted = false")
    long countActive(@Param("ownerId") long ownerId);
}
