package com.example.demo.util;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class MemoryCacheManager {
    
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleanupExecutor = Executors.newScheduledThreadPool(1);
    
    public MemoryCacheManager() {
        // 定时清理过期缓存，每分钟执行一次
        cleanupExecutor.scheduleAtFixedRate(this::cleanupExpiredEntries, 1, 1, TimeUnit.MINUTES);
    }
    
    /**
     * 存储数据
     */
    public void put(String key, String value, long expireSeconds) {
        long expireTime = System.currentTimeMillis() + (expireSeconds * 1000);
        cache.put(key, new CacheEntry(value, expireTime));
    }
    
    /**
     * 获取数据
     */
    public String get(String key) {
        CacheEntry entry = cache.get(key);
        if (entry == null) {
            return null;
        }
        
        // 检查是否过期
        if (System.currentTimeMillis() > entry.expireTime) {
            cache.remove(key);
            return null;
        }
        
        return entry.value;
    }
    
    /**
     * 验证数据
     */
    public boolean validate(String key, String value) {
        String storedValue = get(key);
        if (storedValue == null) {
            return false;
        }
        
        boolean isValid = storedValue.equalsIgnoreCase(value);
        if (isValid) {
            // 验证成功后删除
            remove(key);
        }
        return isValid;
    }
    
    /**
     * 删除数据
     */
    public void remove(String key) {
        cache.remove(key);
    }
    
    /**
     * 检查是否存在
     */
    public boolean containsKey(String key) {
        return get(key) != null;
    }
    
    /**
     * 清理过期条目
     */
    private void cleanupExpiredEntries() {
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(entry -> now > entry.getValue().expireTime);
    }
    
    /**
     * 缓存条目
     */
    private static class CacheEntry {
        String value;
        long expireTime;
        
        CacheEntry(String value, long expireTime) {
            this.value = value;
            this.expireTime = expireTime;
        }
    }
}