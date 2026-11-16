package com.ruye.server.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * 发送找回密码链接。配置了 spring.mail.host 时发邮件；没配置时只写日志，方便本地开发直接从控制台复制链接。
 * 测试里可以替换成捕获链接的实现。
 */
@Component
public class ResetMailer {

    private static final Logger log = LoggerFactory.getLogger(ResetMailer.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String host;
    private final String from;

    public ResetMailer(ObjectProvider<JavaMailSender> sender,
                       @Value("${spring.mail.host:}") String host,
                       @Value("${spring.mail.username:}") String from) {
        this.sender = sender;
        this.host = host;
        this.from = from;
    }

    public void sendReset(String email, String link) {
        JavaMailSender s = host.isBlank() ? null : sender.getIfAvailable();
        if (s == null) {
            log.warn("未配置邮件服务器，找回密码链接只写入日志（仅限开发环境）：{} -> {}", email, link);
            return;
        }
        SimpleMailMessage m = new SimpleMailMessage();
        if (!from.isBlank()) m.setFrom(from);
        m.setTo(email);
        m.setSubject("如页：重置密码");
        m.setText("你正在重置如页账号的密码。30 分钟内打开下面的链接设置新密码：\n\n" + link
                + "\n\n如果不是你本人操作，忽略这封邮件即可，密码不会改变。");
        s.send(m);
    }
}
