// src/utils/mongoDB.js（微信云开发版）
const cloud = require('wx-server-sdk');

// 初始化云开发（填环境ID！）
cloud.init({
  env: 'FHC666' // 比如 env: 'test-123456'
});
// 导出数据库实例（全局复用）
const db = cloud.database();
// 导出数据库操作的辅助方法（如命令符）
const _ = db.command;

// 新增：获取所有巡检员的openid（用于推送消息）
const getInspectorList = async () => {
  const res = await db.collection('member')
    .where({
      MEMBER_ROLE: 'inspector' // 只查巡检员角色
    })
    .field({
      _openid: true // 只取openid字段（微信用户唯一标识）
    })
    .get();
  return res.data.map(item => item._openid); // 返回openid数组
};

module.exports = {
  db,
  _,
  getInspectorList // 导出新增方法
};