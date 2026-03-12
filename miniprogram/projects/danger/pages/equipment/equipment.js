// equipment.js
Page({
  data: {
    formData: {
      EQ_CODE: '',
      EQ_NAME: '',
      EQ_LOCATION: '',
      EQ_MODEL: '',
      EQ_PROD_DATE: '',
      EQ_WARRANTY_DAYS: ''
    },
    // 新增：图片上传相关字段
    equipmentImg: '', // 存储图片临时URL
    uploading: false   // 上传状态标识
  },

  // 监听器材编号输入
  onCodeInput(e) {
    this.setData({
      'formData.EQ_CODE': e.detail.value
    });
  },

  // 监听器材名称输入
  onNameInput(e) {
    this.setData({
      'formData.EQ_NAME': e.detail.value
    });
  },

  // 监听位置输入
  onLocationInput(e) {
    this.setData({
      'formData.EQ_LOCATION': e.detail.value
    });
  },

  // 监听规格型号输入
  onModelInput(e) {
    this.setData({
      'formData.EQ_MODEL': e.detail.value
    });
  },

  // 监听生产日期选择
  onProdDateChange(e) {
    this.setData({
      'formData.EQ_PROD_DATE': e.detail.value
    });
  },

  // 监听保质期输入
  onWarrantyInput(e) {
    this.setData({
      'formData.EQ_WARRANTY_DAYS': e.detail.value
    });
  },

  // 替换原有 chooseImg + uploadImg 函数
chooseImg() {
  wx.chooseImage({ // 兼容低版本基础库，用chooseImage替代chooseMedia
    count: 1,
    sizeType: ['compressed'], // 压缩图片，避免过大
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]; // 注意：chooseImage返回tempFilePaths
      this.uploadImg(tempFilePath);
    },
    fail: (err) => {
      console.error('选择图片失败：', err);
      wx.showToast({ title: '选择图片失败：' + err.errMsg, icon: 'none' });
    }
  });
},

// 替换原有 uploadImg 函数
uploadImg(tempFilePath) {
  this.setData({ uploading: true });
  const cloudPath = `equipment_imgs/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.png`;

  wx.cloud.uploadFile({
    cloudPath: cloudPath,
    filePath: tempFilePath,
    success: (uploadRes) => {
      // console.log('上传成功，fileID：', uploadRes.fileID);
      // 直接存储 fileID，而不是 tempFileURL
      this.setData({
        equipmentImg: uploadRes.fileID,
        uploading: false
      });
      wx.showToast({ title: '图片上传成功', icon: 'success' });
    },
    fail: (err) => {
      console.error('上传失败：', err);
      this.setData({ uploading: false });
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  });
},

  // 新增：删除已上传的图片
  deleteImg() {
    this.setData({ equipmentImg: '' });
  },

  // 提交表单（修改：新增图片字段）
  async submitEquipment() {
    const { EQ_CODE, EQ_NAME, EQ_PROD_DATE, EQ_WARRANTY_DAYS } = this.data.formData;
    // 保留原有必填项校验
    if (!EQ_CODE || !EQ_NAME || !EQ_PROD_DATE || !EQ_WARRANTY_DAYS) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      // 整合表单数据和图片字段
      const submitData = {
        ...this.data.formData,
        EQ_IMG: this.data.equipmentImg, // 新增图片URL字段
        // 补充时间字段格式转换（确保数据库存储为Date类型）
        EQ_PROD_DATE: new Date(this.data.formData.EQ_PROD_DATE),
        EQ_WARRANTY_DAYS: parseInt(this.data.formData.EQ_WARRANTY_DAYS),
        EQ_CREATE_TIME: new Date(),
        EQ_STATUS: '正常'
      };

      // 调用微信云函数
      const res = await wx.cloud.callFunction({
        name: 'equipment', // 云函数名称
        data: {
          action: 'addEquipment', // 对应云函数的action
          data: submitData // 包含图片的完整数据
        }
      });

      if (res.result.code === 0) {
        wx.showToast({ title: '添加成功', icon: 'success' });
        // 清空表单和图片
        this.setData({ 
          formData: {},
          equipmentImg: '' 
        });
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '提交失败：' + e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});