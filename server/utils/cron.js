const schedule = require('node-schedule');
const AuditLog = require('../models/AuditLog');
const { Op } = require('sequelize');
const fs = require('fs-extra');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

// 备份目录
const BACKUP_DIR = path.join(__dirname, '../../backups');
fs.ensureDirSync(BACKUP_DIR);

// === 每天凌晨 2 点执行备份 ===
const job = schedule.scheduleJob('0 2 * * *', async function() {
    console.log('🔄 开始执行日志备份任务...');
    
    // 1. 定义备份范围：备份昨天的日志 (或者备份6个月前的并归档)
    // 为了满足“保留6个月”且“数据库不无限膨胀”，策略如下：
    // - 每天将日志导出为 CSV 文件存储在磁盘（文件可保留数年）
    // - 数据库中只保留最近 6 个月的数据，超过的在备份后删除
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    try {
        // A. 查找需要归档的数据 (6个月前的)
        const logsToArchive = await AuditLog.findAll({
            where: {
                createdAt: { [Op.lt]: sixMonthsAgo }
            },
            raw: true
        });

        if (logsToArchive.length > 0) {
            const fileName = `audit_logs_archive_${Date.now()}.csv`;
            const filePath = path.join(BACKUP_DIR, fileName);

            // B. 写入 CSV 文件
            const csvWriter = createObjectCsvWriter({
                path: filePath,
                header: [
                    {id: 'id', title: 'ID'},
                    {id: 'operatorName', title: 'User'},
                    {id: 'action', title: 'Action'},
                    {id: 'details', title: 'Details'},
                    {id: 'status', title: 'Status'},
                    {id: 'ipAddress', title: 'IP'},
                    {id: 'createdAt', title: 'Time'}
                ]
            });

            await csvWriter.writeRecords(logsToArchive);
            console.log(`✅ 已归档 ${logsToArchive.length} 条日志到 ${fileName}`);

            // C. 只有在成功备份后，才从数据库删除 (释放空间)
            // 注意：这符合“保留不低于6个月”的要求，因为数据库里存了6个月，
            // 文件里存了更久的数据。
            await AuditLog.destroy({
                where: {
                    createdAt: { [Op.lt]: sixMonthsAgo }
                }
            });
            console.log('🗑️ 已清理数据库过期日志');
        } else {
            console.log('无过期日志需要归档');
        }

    } catch (err) {
        console.error('❌ 日志备份任务失败:', err);
    }
});

module.exports = job;