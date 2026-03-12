// cloudfunctions/equipment/services/uploadFileService.js
const cloud = require('wx-server-sdk');
const { wrapAsync } = require('./commonService');

/**
 * 上传水印照片到云存储（生成永久链接）
 * @param {Object} params - {fileID, recordId, type: 'inspection/problem/replace'}
 * @returns {Promise<Object>} 上传结果（含永久链接）
 */
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

  // 2. 获取文件永久访问链接
  const fileUrlResult = await cloud.getTempFileURL({
    fileList: [copyResult.fileID]
  });
  const fileUrl = fileUrlResult.fileList[0].tempFileURL;

  // 3. 记录文件关联关系（便于后台查询）
  await cloud.database().collection('file_record').add({
    data: {
      recordId, // 关联的巡检/替换记录ID
      fileID: copyResult.fileID,
      fileUrl,
      type, // 照片类型：inspection(巡检)/problem(隐患)/replace(替换)
      createTime: cloud.database().serverDate(),
      uploaderOpenid: cloud.getWXContext().OPENID // 上传者ID
    }
  });

  return {
    code: 0,
    msg: '水印照片上传成功',
    data: {
      fileID: copyResult.fileID,
      fileUrl,
      fileName: newFileName
    }
  };
});

/**
 * 根据记录ID查询水印照片列表
 * @param {string} recordId - 巡检/替换记录ID
 * @param {string} type - 照片类型（可选）
 * @returns {Promise<Array>} 照片列表
 */
const getWatermarkImagesByRecordId = wrapAsync(async (recordId, type) => {
  if (!recordId) {
    throw new Error('记录ID不能为空');
  }

  let whereCondition = { recordId };
  if (type) {
    whereCondition.type = type;
  }

  const res = await cloud.database().collection('file_record')
    .where(whereCondition)
    .orderBy('createTime', 'desc')
    .get();

  return res.data || [];
});

module.exports = {
  uploadWatermarkImage,
  getWatermarkImagesByRecordId
};