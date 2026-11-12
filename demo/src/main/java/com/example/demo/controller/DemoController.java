package com.example.demo.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/")
public class DemoController {
    
    @GetMapping
    public String hello() {
        return "Hello World!";
    }
    
    // 可选：添加另一个端点来测试
    @GetMapping("/test")
    public String test() {
        return "Test endpoint is working!";
    }
}