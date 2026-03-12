// 云函数入口文件
const cloud = require('wx-server-sdk');
// 初始化云开发（确保env和你的项目一致）
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 导入所有设备服务方法
const {
  addEquipment,
  refreshEquipmentStatus,
  getExpireEquipment,
  sendExpireNotice,
  getEquipmentDetail,
  markAsRead,
  getAllEquipment,
  // 新增巡检相关方法
  createInspectionPlan,
  getInspectionPlanList,
  getInspectionRecordList,
  submitInspectionRecord,
  // 新增器材替换相关方法
  getEquipmentById,
  replaceExpiredEquipment,
  // 新增：查询已被占用的新器材ID
  getUsedNewEquipmentIds
} = require('./services/equipmentService');

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data, id } = event;
  const wxContext = cloud.getWXContext();

  try {
    // 统一返回格式
    const response = (result) => ({
      code: 0,
      msg: '操作成功',
      data: result,
      requestId: wxContext.requestId
    });

    // 路由分发（按action匹配对应方法）
    switch (action) {
      // 原有设备管理接口
      case 'addEquipment':
        return response(await addEquipment(data));
      
      case 'refreshEquipmentStatus':
        return response(await refreshEquipmentStatus());
      
      case 'getExpireEquipment':
        return response(await getExpireEquipment());
      
      case 'sendExpireNotice':
        return response(await sendExpireNotice(data));
      
      case 'getEquipmentDetail':
        return response(await getEquipmentDetail(id));
      
      case 'markAsRead':
        return response(await markAsRead(id));
      
      case 'getAllEquipment':
        return response(await getAllEquipment());

      // 新增巡检相关接口
      case 'createInspectionPlan':
        return response(await createInspectionPlan(data));
      
      case 'getInspectionPlanList':
        return response(await getInspectionPlanList());
      
      case 'getInspectionRecordList':
        return response(await getInspectionRecordList(id));
      
      case 'submitInspectionRecord':
        return response(await submitInspectionRecord(data));

      // 新增器材替换相关接口（核心）
      case 'getEquipmentById':
        return response(await getEquipmentById(id));
      
      case 'replaceExpiredEquipment':
        return response(await replaceExpiredEquipment(data));
      
      // 🌟 新增：查询已被占用的新器材ID（解决重复替换问题）
      case 'getUsedNewEquipmentIds':
        return response(await getUsedNewEquipmentIds());

      // 未知action处理
      default:
        return {
          code: -1,
          msg: `未知的操作类型：${action}`,
          requestId: wxContext.requestId
        };
    }
  } catch (error) {
    // 统一异常处理
    console.error(`云函数执行失败[${action}]:`, error);
    return {
      code: -2,
      msg: error.message || '服务器内部错误',
      requestId: wxContext.requestId,
      error: process.env.NODE_ENV === 'development' ? error.stack : '' // 开发环境返回堆栈
    };
  }
};