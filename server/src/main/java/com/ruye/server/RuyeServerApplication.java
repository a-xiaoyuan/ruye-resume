package com.ruye.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/** 如页 Ruye 的可选云同步后端。不登录时前端完全不访问它。 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class RuyeServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(RuyeServerApplication.class, args);
    }
}
