// src/services/equipmentService.js（微信云开发版）
const { db, _, getInspectorList } = require('../utils/mongoDB');
const { validateParams, wrapAsync } = require('./commonService');
const Joi = require('joi');
const cloud = require('wx-server-sdk');

// 订阅消息模板ID（抽离成常量，便于维护）
const SUBSCRIBE_TEMPLATE_ID = 'Tu0TnM12r5u8ajtO3TAyvekRxgBvLxLTqBKlwC7MBUA';
// 消息跳转页面路径（抽离成常量）
const MESSAGE_JUMP_PAGE = '/projects/danger/pages/equipment/equipment';

/**
 * 【新增】水印照片上传与查询核心方法
 * 抽离为内部方法，避免重复代码
 */
// 上传水印照片到云存储并记录关联关系
const uploadWatermarkImage = wrapAsync(async (params) => {
  const { fileID, recordId, type = 'inspection' } = params;
  if (!fileID || !recordId) {
    throw new Error('文件ID和记录ID不能为空');
  }

  // 1. 复制临时文件到永久存储（避免临时链接失效）
  const newFileName = `${type}/${recordId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
  const copyResult = await cloud.uploadFile({
    cloudPath: newFileName,
    fileContent: await cloud.downloadFile({ fileID }).then(res => res.fileContent)
  });

  // 2. 获取文件临时访问链接（云存储无永久链接，用临时链接+定期刷新）
  const fileUrlResult = await cloud.getTempFileURL({
    fileList: [copyResult.fileID]
  });
  const fileUrl = fileUrlResult.fileList[0].tempFileURL;

  // 3. 记录文件关联关系（便于后台查询）
  await db.collection('file_record').add({
    data: {
      recordId, // 关联的巡检/替换记录ID
      fileID: copyResult.fileID,
      fileUrl,
      type, // 照片类型：inspection(巡检)/problem(隐患)/replace(替换)
      createTime: db.serverDate(),
      uploaderOpenid: cloud.getWXContext().OPENID // 上传者ID
    }
  });

  return {
    fileID: copyResult.fileID,
    fileUrl,
    fileName: newFileName
  };
});

// 根据记录ID查询水印照片列表
const getWatermarkImagesByRecordId = wrapAsync(async (recordId, type) => {
  if (!recordId) {
    throw new Error('记录ID不能为空');
  }

  let whereCondition = { recordId };
  if (type) {
    whereCondition.type = type;
  }

  const res = await db.collection('file_record')
    .where(whereCondition)
    .orderBy('createTime', 'desc')
    .get();

  return res.data || [];
});

/**
 * 1. 查询单条设备详情
 * @param {string} id - 设备ID
 * @returns {Promise<Object>} 设备详情
 */
const getEquipmentDetail = wrapAsync(async (id) => {
  if (!id || typeof id !== 'string') {
    throw new Error('设备ID不能为空且必须为字符串');
  }

  const res = await db.collection('equipment').doc(id).get();
  if (!res.data) {
    throw new Error(`未查询到ID为${id}的设备信息`);
  }

  return res.data;
});

/**
 * 新增：根据ID获取器材详情（适配替换页）
 * @param {string} id - 器材ID
 * @returns {Promise<Object>} 器材详情
 */
const getEquipmentById = wrapAsync(async (id) => {
  if (!id || typeof id !== 'string') {
    throw new Error('器材ID不能为空且必须为字符串');
  }

  const res = await db.collection('equipment').doc(id).get();
  if (!res.data) {
    throw new Error(`未查询到ID为${id}的器材信息`);
  }

  return res.data;
});

/**
 * 🌟 新增：查询所有已被替换占用的新器材ID（解决重复替换问题）
 * @returns {Promise<Array<string>>} 已占用的新器材ID列表（去重）
 */
const getUsedNewEquipmentIds = wrapAsync(async () => {
  try {
    // 查询替换记录表（无此表时返回空数组，避免报错）
    const replaceRes = await db.collection('equipment_replace').get().catch(err => {
      if (err.errCode === -502005) { // 集合不存在错误
        return { data: [] };
      }
      throw err;
    });

    if (!replaceRes.data || replaceRes.data.length === 0) {
      return [];
    }

    // 提取newEquipmentId并去重
    const usedIds = [...new Set(replaceRes.data.map(item => item.newEquipmentId))];
    return usedIds;
  } catch (error) {
    console.error('查询已占用器材ID失败：', error);
    throw new Error('查询已占用器材失败，请重试');
  }
});

/**
 * 🌟 重构：替换过期器材（修复逻辑漏洞+记录替换关系）
 * @param {Object} data - 替换数据 {oldEquipmentId, newEquipmentId, newExpireTime, replaceTime}
 * @returns {Promise<Object>} 替换结果
 */
const replaceExpiredEquipment = wrapAsync(async (data) => {
  const { oldEquipmentId, newEquipmentId, newExpireTime, replaceTime } = data;
  
  // 严格参数校验
  if (!oldEquipmentId || typeof oldEquipmentId !== 'string') {
    throw new Error('旧器材ID不能为空且必须为字符串');
  }
  if (!newEquipmentId || typeof newEquipmentId !== 'string') {
    throw new Error('新器材ID不能为空且必须为字符串');
  }

  // 🌟 新增校验1：检查新器材是否已被占用
  const usedIds = await getUsedNewEquipmentIds();
  if (usedIds.includes(newEquipmentId)) {
    throw new Error('该新器材已被其他旧器材替换，无法重复使用');
  }

  // 🌟 新增校验2：检查新器材是否过期
  const newEquipment = await getEquipmentById(newEquipmentId);
  if (newEquipment.EQ_STATUS === '已过期' || newEquipment.EQ_STATUS === '即将过期') {
    throw new Error('不能替换为已过期/即将过期的器材');
  }

  // 校验新有效期格式（复用原有逻辑）
  const newExpireDate = new Date(newExpireTime || newEquipment.EQ_EXPIRE_DATE);
  if (isNaN(newExpireDate.getTime())) {
    throw new Error('新有效期格式错误，必须为合法日期');
  }
  if (newExpireDate < new Date()) {
    throw new Error('新有效期不能选择过去的日期');
  }

  // 开启事务：确保操作原子性
  const transaction = await db.startTransaction();
  try {
    // 1. 记录替换关系到equipment_replace表（新增）
    await transaction.collection('equipment_replace').add({
      data: {
        oldEquipmentId,
        newEquipmentId,
        newExpireTime: newExpireDate,
        replaceTime: replaceTime || db.serverDate(),
        createTime: db.serverDate()
      }
    });

    // 2. 更新旧器材状态（标记为已替换）
    const oldUpdateResult = await transaction.collection('equipment').doc(oldEquipmentId).update({
      data: {
        EQ_STATUS: '已替换',
        replacedBy: newEquipmentId,
        replaceTime: replaceTime || db.serverDate(),
        EQ_UPDATE_TIME: db.serverDate(),
        isRead: true
      }
    });

    if (oldUpdateResult.stats.updated === 0) {
      throw new Error('旧器材状态更新失败，未找到对应器材或状态未变更');
    }

    // 3. 更新新器材状态（标记为已占用，避免重复替换）
    const newUpdateResult = await transaction.collection('equipment').doc(newEquipmentId).update({
      data: {
        EQ_STATUS: '已占用', // 🌟 改为已占用，而非重置为正常
        EQ_EXPIRE_DATE: newExpireDate,
        EQ_UPDATE_TIME: db.serverDate(),
        isRead: false,
        isOccupied: true // 新增：标记为已占用的替换用器材
      }
    });

    if (newUpdateResult.stats.updated === 0) {
      throw new Error('新器材信息更新失败，未找到对应器材');
    }

    // 提交事务
    await transaction.commit();

    return {
      code: 0,
      msg: '器材替换成功，提醒已自动消除',
      data: {
        oldEquipmentUpdate: oldUpdateResult.stats,
        newEquipmentUpdate: newUpdateResult.stats,
        replaceTime: replaceTime || new Date(),
        usedNewEquipmentIds: [...usedIds, newEquipmentId] // 返回更新后的占用列表
      }
    };
  } catch (error) {
    // 回滚事务
    await transaction.rollback();
    throw new Error(`替换器材失败：${error.message}`);
  }
});

/**
 * 2. 推送订阅消息给巡检员
 * @param {Array<Object>} expireList - 过期/即将过期设备列表
 * @returns {Promise<Object>} 推送结果
 */
const sendExpireNotice = wrapAsync(async (expireList) => {
  if (!Array.isArray(expireList) || expireList.length === 0) {
    return { msg: '暂无需要提醒的设备' };
  }

  const inspectorOpenids = await getInspectorList();
  if (inspectorOpenids.length === 0) {
    throw new Error('未获取到巡检员列表，无法推送提醒消息');
  }

  const pushTasks = [];
  inspectorOpenids.forEach(openid => {
    expireList.forEach(equipment => {
      // 🌟 核心修改：区分已占用器材和普通器材的提醒文案
      let tipText = '';
      if (equipment.isOccupied || equipment.EQ_STATUS === '已占用') {
        // 已占用的器材过期：提醒需要再次替换
        tipText = `${equipment.EQ_NAME || '未知设备'}(${equipment.EQ_CODE || '未知编号'})为替换用器材，已${equipment.EQ_STATUS === '已占用' ? '即将过期' : equipment.EQ_STATUS}，请及时更换新器材`;
      } else {
        // 普通器材过期：原有文案
        tipText = `${equipment.EQ_NAME || '未知设备'}(${equipment.EQ_CODE || '未知编号'})已${equipment.EQ_STATUS}，请及时处理`;
      }
      
      pushTasks.push(
        cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: SUBSCRIBE_TEMPLATE_ID,
          page: MESSAGE_JUMP_PAGE,
          data: {
            thing3: { value: equipment.EQ_NAME || '未知设备' },
            thing4: { value: equipment.EQ_LOCATION || '未知位置' },
            character_string1: { value: equipment.EQ_CODE || '未知编号' },
            thing2: { value: tipText } // 差异化提醒文案
          }
        }).catch(err => {
          console.error(`向${openid}推送${equipment.EQ_CODE}消息失败：`, err);
        })
      );
    });
  });

  await Promise.all(pushTasks);
  
  return { 
    msg: `已向${inspectorOpenids.length}名巡检员推送${expireList.length}条设备提醒`,
    totalPush: pushTasks.length,
    inspectorCount: inspectorOpenids.length,
    equipmentCount: expireList.length
  };
});

/**
 * 3. 设备录入参数校验规则
 */
const equipmentSchema = Joi.object({
  EQ_CODE: Joi.string().trim().required().messages({
    'any.required': '设备编号不能为空',
    'string.empty': '设备编号不能为空'
  }),
  EQ_NAME: Joi.string().trim().required().messages({
    'any.required': '设备名称不能为空',
    'string.empty': '设备名称不能为空'
  }),
  EQ_LOCATION: Joi.string().trim().required().messages({
    'any.required': '设备位置不能为空',
    'string.empty': '设备位置不能为空'
  }),
  EQ_MODEL: Joi.string().trim().required().messages({
    'any.required': '规格型号不能为空',
    'string.empty': '规格型号不能为空'
  }),
  EQ_PROD_DATE: Joi.string().required().messages({
    'any.required': '生产日期不能为空',
    'string.empty': '生产日期不能为空'
  }).custom((value, helpers) => {
    // 校验日期格式是否合法
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return helpers.error('string.date.format', { value });
    }
    return value;
  }, '日期格式校验'),
  EQ_WARRANTY_DAYS: Joi.number().integer().min(1).required().messages({
    'number.min': '保质期必须大于0',
    'any.required': '保质期不能为空',
    'number.integer': '保质期必须为整数'
  }),
  // 新增：EQ_IMG字段校验规则（可选，允许为空字符串）
  EQ_IMG: Joi.string().allow('').optional().messages({
    'string.base': '图片链接格式不正确，必须为字符串类型'
  })
});

/**
 * 4. 计算设备状态（正常/即将过期/已过期）
 * @param {string|Date} expireDate - 过期日期
 * @returns {string} 设备状态
 */
const calcStatus = (expireDate) => {
  if (!expireDate) return '未知状态';
  
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expireTime = new Date(expireDate).getTime();

  if (isNaN(expireTime)) return '未知状态';

  if (expireTime < now.getTime()) {
    return '已过期';
  } else if (expireTime <= thirtyDaysLater.getTime()) {
    return '即将过期';
  } else {
    return '正常';
  }
};

/**
 * 5. 新增设备
 * @param {Object} equipmentData - 设备数据
 * @returns {Promise<Object>} 新增结果
 */
const addEquipment = wrapAsync(async (equipmentData) => {
  // 参数校验（现在会保留EQ_IMG字段）
  const validData = validateParams(equipmentData, equipmentSchema);

  // 计算到期日期
  const prodDate = new Date(validData.EQ_PROD_DATE);
  const expireDate = new Date(prodDate);
  expireDate.setDate(prodDate.getDate() + validData.EQ_WARRANTY_DAYS);

  // 计算初始状态
  const EQ_STATUS = calcStatus(expireDate);

  // 插入数据库（...validData会包含EQ_IMG）
  const result = await db.collection('equipment').add({
    data: {
      ...validData,
      EQ_EXPIRE_DATE: expireDate,
      EQ_STATUS: EQ_STATUS,
      EQ_CREATE_TIME: db.serverDate(),
      EQ_UPDATE_TIME: db.serverDate(),
      isRead: false, // 新增：默认未读状态
      isOccupied: false // 新增：默认未占用
    }
  });

  return {
    id: result._id,
    msg: '设备添加成功',
    status: EQ_STATUS,
    expireDate: expireDate
  };
});

/**
 * 6. 批量更新设备状态（定时任务用）
 * @returns {Promise<Object>} 更新结果
 */
const refreshEquipmentStatus = wrapAsync(async () => {
  const equipmentList = await db.collection('equipment')
    .field({
      _id: true,
      EQ_EXPIRE_DATE: true,
      EQ_STATUS: true,
      EQ_NAME: true,
      EQ_CODE: true,
      EQ_LOCATION: true,
      isOccupied: true // 新增：获取已占用标记
    })
    .get();

  if (equipmentList.data.length === 0) {
    return { msg: '暂无设备数据需要更新', noticeMsg: '无设备数据' };
  }

  const updateTasks = [];
  const needNoticeList = [];

  for (const item of equipmentList.data) {
    const newStatus = calcStatus(item.EQ_EXPIRE_DATE);
    if (item.EQ_STATUS !== newStatus) {
      // 构建更新任务（保留isOccupied标记）
      const updateData = {
        EQ_STATUS: newStatus,
        EQ_UPDATE_TIME: db.serverDate()
      };
      // 已占用的器材即使状态变化，仍保留isOccupied标记
      if (item.isOccupied) {
        updateData.isOccupied = true;
      }

      updateTasks.push(
        db.collection('equipment').doc(item._id).update({
          data: updateData
        })
      );

      // 🌟 核心修改：已占用的器材即将过期/已过期，也加入提醒列表
      if (['已过期', '即将过期'].includes(newStatus)) {
        // 为已占用的器材添加专属标记，便于提醒文案区分
        const noticeItem = {
          ...item,
          EQ_STATUS: newStatus,
          isOccupied: item.isOccupied || false // 确保有该字段
        };
        needNoticeList.push(noticeItem);
      }
    }
  }

  await Promise.all(updateTasks);
  
  // 推送提醒（区分普通器材和已占用器材）
  let noticeMsg = '暂无需要提醒的设备';
  if (needNoticeList.length > 0) {
    const noticeResult = await sendExpireNotice(needNoticeList);
    noticeMsg = noticeResult.msg;
  }

  return { 
    msg: `成功更新${updateTasks.length}个设备的状态（总设备数：${equipmentList.data.length}）`,
    noticeMsg,
    updateCount: updateTasks.length,
    totalEquipment: equipmentList.data.length
  };
});

/**
 * 7. 查询即将过期/已过期的设备（兼容isRead字段）
 * @returns {Promise<Array<Object>>} 过期设备列表
 */
const getExpireEquipment = wrapAsync(async () => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 🌟 核心修改：仅排除「已替换」的器材，保留「已占用」的器材
  const list = await db.collection('equipment')
    .where({
      EQ_EXPIRE_DATE: _.lte(thirtyDaysLater),
      EQ_STATUS: _.nin(['已替换']) // 只排除已替换，保留已占用/正常/即将过期/已过期
    })
    .orderBy('EQ_EXPIRE_DATE', 'asc')
    .get();

  // 兼容历史数据：补充isRead和isOccupied字段
  return list.data.map(item => ({
    ...item,
    isRead: item.isRead || false,
    isOccupied: item.isOccupied || false
  }));
});

/**
 * 8. 新增：标记设备消息为已读
 * @param {string} id - 设备ID
 * @returns {Promise<Object>} 标记结果
 */
const markAsRead = wrapAsync(async (id) => {
  if (!id || typeof id !== 'string') {
    throw new Error('设备ID不能为空且必须为字符串');
  }

  // 更新isRead状态为true
  const result = await db.collection('equipment').doc(id).update({
    data: {
      isRead: true,
      EQ_UPDATE_TIME: db.serverDate()
    }
  });

  // 校验更新结果
  if (result.stats.updated === 0) {
    throw new Error('标记已读失败，未找到对应设备或状态未变更');
  }

  return {
    code: 0,
    msg: '消息已标记为已读',
    data: result
  };
});

/**
 * 9. 新增：查询所有器材（含未过期）
 * @returns {Promise<Array<Object>>} 所有器材列表
 */
const getAllEquipment = wrapAsync(async () => {
  const list = await db.collection('equipment')
    .orderBy('EQ_EXPIRE_DATE', 'asc')
    .get();

  // 兼容历史数据，补充isRead和isOccupied字段
  return list.data.map(item => ({
    ...item,
    isRead: item.isRead || false,
    isOccupied: item.isOccupied || false
  }));
});

/**
 * 10. 新增：创建月度巡检计划
 * @param {Object} planData - 计划数据 {month, equipmentIds}
 */
const createInspectionPlan = wrapAsync(async (planData) => {
  const { month, equipmentIds } = planData;
  if (!month || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
    throw new Error('巡检月份和器材ID不能为空');
  }

  // 检查当月是否已创建计划
  const existPlan = await db.collection('inspection_plan')
    .where({ month })
    .limit(1)
    .get();

  if (existPlan.data.length > 0) {
    throw new Error(`已创建${month}月的巡检计划，请勿重复创建`);
  }

  // 创建计划
  const planResult = await db.collection('inspection_plan').add({
    data: {
      month,
      equipmentIds,
      status: '未开始', // 未开始/进行中/已完成
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });

  // 批量创建巡检记录（关联计划）
  const recordTasks = equipmentIds.map(equipmentId => 
    db.collection('inspection_record').add({
      data: {
        planId: planResult._id,
        equipmentId,
        status: '未巡检', // 未巡检/已巡检
        createTime: db.serverDate()
      }
    })
  );
  await Promise.all(recordTasks);

  return {
    code: 0,
    msg: `${month}月巡检计划创建成功，共生成${equipmentIds.length}条巡检项`,
    planId: planResult._id,
    recordCount: equipmentIds.length
  };
});

/**
 * 11. 新增：获取月度巡检计划列表
 */
const getInspectionPlanList = wrapAsync(async () => {
  try {
    const list = await db.collection('inspection_plan')
      .orderBy('month', 'desc')
      .get();
    // 兼容空集合，返回空数组而非报错
    return list.data || [];
  } catch (err) {
    // 捕获集合不存在的错误，返回空数组
    if (err.errCode === -502005) {
      return [];
    }
    throw err;
  }
});

/**
 * 12. 新增：获取指定计划的巡检记录（关联器材详情）
 * @param {string} planId - 计划ID
 */
const getInspectionRecordList = wrapAsync(async (planId) => {
  if (!planId) throw new Error('计划ID不能为空');

  // 查询巡检记录
  const recordList = await db.collection('inspection_record')
    .where({ planId })
    .get();

  // 关联器材详情 + 水印照片
  const recordWithEquipment = await Promise.all(
    recordList.data.map(async (record) => {
      const equipment = await db.collection('equipment').doc(record.equipmentId).get();
      // 关联水印照片
      const watermarkImages = await getWatermarkImagesByRecordId(record._id);
      return {
        ...record,
        equipment: equipment.data || {},
        watermarkImages // 新增：返回水印照片列表
      };
    })
  );

  return recordWithEquipment;
});

/**
 * 13. 新增：提交巡检记录（标记完成/记录问题 + 水印照片上传）
 * @param {Object} recordData - 巡检数据
 */
const submitInspectionRecord = wrapAsync(async (recordData) => {
  const { recordId, result, problemDesc = '', problemImg = '', planId } = recordData;
  if (!recordId || !result) throw new Error('记录ID和巡检结果不能为空');

  // 新增：处理水印照片上传（problemImg是前端传的临时fileID数组）
  let fileUrls = [];
  if (problemImg && Array.isArray(problemImg) && problemImg.length > 0) {
    const uploadTasks = problemImg.map(fileID => 
      uploadWatermarkImage({
        fileID,
        recordId,
        type: result === '异常' ? 'problem' : 'inspection'
      })
    );
    const uploadResults = await Promise.all(uploadTasks);
    fileUrls = uploadResults.map(item => item.fileUrl);
  }

  // 更新巡检记录（新增fileUrls字段存储照片链接）
  const updateResult = await db.collection('inspection_record').doc(recordId).update({
    data: {
      result, // 正常/异常
      problemDesc,
      problemImg: fileUrls, // 存储永久照片链接（替换原临时fileID）
      inspectTime: db.serverDate(),
      status: '已巡检',
      updateTime: db.serverDate()
    }
  });

  // 检查当前计划的所有记录是否都已完成
  const recordList = await db.collection('inspection_record')
    .where({ planId })
    .get();

  const allCompleted = recordList.data.every(item => item.status === '已巡检');
  if (allCompleted) {
    // 更新计划状态为已完成
    await db.collection('inspection_plan').doc(planId).update({
      data: {
        status: '已完成',
        updateTime: db.serverDate()
      }
    });
  } else if (recordList.data.some(item => item.status === '已巡检')) {
    // 更新计划状态为进行中
    await db.collection('inspection_plan').doc(planId).update({
      data: {
        status: '进行中',
        updateTime: db.serverDate()
      }
    });
  }

  return {
    code: 0,
    msg: '巡检记录提交成功',
    updated: updateResult.stats.updated,
    fileUrls // 返回上传的照片链接
  };
});

/**
 * 14. 新增：获取巡检记录详情（含水印照片）
 * @param {string} recordId - 巡检记录ID
 * @returns {Promise<Object>} 巡检详情（含器材+照片）
 */
const getInspectionRecordDetail = wrapAsync(async (recordId) => {
  if (!recordId) throw new Error('记录ID不能为空');

  // 1. 获取巡检记录基本信息
  const record = await db.collection('inspection_record').doc(recordId).get();
  if (!record.data) throw new Error('巡检记录不存在');

  // 2. 获取关联的水印照片
  const watermarkImages = await getWatermarkImagesByRecordId(recordId);

  // 3. 获取关联的器材信息
  const equipment = await db.collection('equipment').doc(record.data.equipmentId).get();

  return {
    ...record.data,
    equipment: equipment.data || {},
    watermarkImages // 水印照片列表
  };
});

// 🌟 导出所有方法（含新增的水印照片相关）
module.exports = {
  addEquipment,
  refreshEquipmentStatus,
  getExpireEquipment,
  sendExpireNotice,
  getEquipmentDetail,
  markAsRead,
  getAllEquipment,
  // 巡检相关函数（含水印照片）
  createInspectionPlan,
  getInspectionPlanList,
  getInspectionRecordList,
  submitInspectionRecord,
  getInspectionRecordDetail, // 新增导出
  // 替换相关函数（新增+重构）
  getEquipmentById,
  replaceExpiredEquipment,
  getUsedNewEquipmentIds,
  // 水印照片相关（可选导出，供其他服务调用）
  uploadWatermarkImage,
  getWatermarkImagesByRecordId
};