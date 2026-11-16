package com.ruye.server.resume;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 简历同步接口。所有操作都限定在当前登录用户名下，别人的简历一律返回 404 */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {

    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    private static long uid(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }

    @GetMapping
    public List<ResumeDtos.Summary> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(uid(jwt));
    }

    @GetMapping("/{id}")
    public ResumeDtos.Detail get(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return service.get(uid(jwt), id);
    }

    @PutMapping("/{id}")
    public ResumeDtos.WriteResult put(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Validated @RequestBody ResumeDtos.PutRequest body) {
        return service.put(uid(jwt), id, body);
    }

    /** 历史版本（含当前版本），新的在前。回收站里的简历也能查，用来恢复 */
    @GetMapping("/{id}/revisions")
    public List<ResumeDtos.RevisionSummary> revisions(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return service.revisions(uid(jwt), id);
    }

    @GetMapping("/{id}/revisions/{version}")
    public ResumeDtos.Detail revision(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable long version) {
        return service.revision(uid(jwt), id, version);
    }

    @DeleteMapping("/{id}")
    public ResumeDtos.WriteResult delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam(required = false) Long baseVersion) {
        return service.delete(uid(jwt), id, baseVersion);
    }
}
