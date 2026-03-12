// 云函数 init_equipment_collection.js
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 插入第一条测试数据（自动创建equipment集合）
    await db.collection('equipment').add({
      data: {
        EQ_CODE: 'XF-001',
        EQ_NAME: '干粉灭火器',
        EQ_LOCATION: '1F大堂',
        EQ_MODEL: 'MFZ/ABC4',
        EQ_PROD_DATE: new Date('2024-01-01'),
        EQ_WARRANTY_DAYS: 1095,
        EQ_EXPIRE_DATE: new Date('2027-01-01'),
        EQ_STATUS: '正常',
        EQ_CREATE_TIME: new Date(),
        EQ_UPDATE_TIME: new Date()
      }
    });
    return { code: 0, msg: 'equipment集合创建并初始化成功' };
  } catch (e) {
    return { code: -1, msg: '创建失败：' + e.message };
  }
};