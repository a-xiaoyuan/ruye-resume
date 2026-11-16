package com.ruye.server.common;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ruye.server.auth.PasswordResetTokenRepository;
import com.ruye.server.auth.RefreshTokenRepository;
import com.ruye.server.config.RuyeProperties;
import com.ruye.server.resume.ResumeRepository;
import com.ruye.server.resume.ResumeRevisionRepository;

/** 每天凌晨清理：软删除超过保留期的简历、过期或已作废的令牌 */
@Component
public class MaintenanceJob {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceJob.class);
    /** 作废的刷新令牌多留 7 天，用于重用检测 */
    private static final Duration REVOKED_KEEP = Duration.ofDays(7);

    private final ResumeRepository resumes;
    private final ResumeRevisionRepository revisions;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final RuyeProperties props;

    public MaintenanceJob(ResumeRepository resumes, ResumeRevisionRepository revisions, RefreshTokenRepository refreshTokens, PasswordResetTokenRepository resetTokens, RuyeProperties props) {
        this.resumes = resumes;
        this.revisions = revisions;
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
        this.props = props;
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purge() {
        Instant now = Instant.now();
        Instant before = now.minus(Duration.ofDays(props.retention().deletedResumeDays()));
        revisions.purgeForDeleted(before);
        int r = resumes.purgeDeleted(before);
        int t = refreshTokens.purge(now, now.minus(REVOKED_KEEP));
        int p = resetTokens.purge(now);
        log.info("定时清理：简历 {} 份，刷新令牌 {} 个，重置令牌 {} 个", r, t, p);
    }
}
