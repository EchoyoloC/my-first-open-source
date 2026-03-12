Page({
  data: {
    recordId: '',
    planId: '',
    result: '正常', // 默认选中“正常”
    problemDesc: '',
    problemImg: '' // 水印图片的fileID（必填）
  },

  onLoad(options) {
    // 获取从记录列表页传过来的参数
    this.setData({
      recordId: options.recordId,
      planId: options.planId
    });
  },

  // 切换巡检结果（正常/异常）
  onResultChange(e) {
    const result = e.detail.value;
    this.setData({
      result,
      // 切换为正常时清空问题描述（图片保留）
      problemDesc: result === '正常' ? '' : this.data.problemDesc
    });
  },

  // 输入问题描述
  onProblemDescInput(e) {
    this.setData({
      problemDesc: e.detail.value
    });
  },

  // 选择并上传水印图片（适配水印相机）
  uploadImg() {
    wx.chooseImage({
      count: 1, // 仅允许上传1张水印图片
      sizeType: ['compressed'], // 压缩图片（不影响水印）
      sourceType: ['album', 'camera'], // 支持相册（水印相机）/相机
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.uploadToCloud(tempFilePath);
      },
      fail: () => {
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  // 上传图片到云存储（保存水印图片）
  uploadToCloud(tempFilePath) {
    wx.showLoading({ title: '上传水印图片中...' });
    // 生成唯一的云存储路径（区分正常/异常）
    const cloudPath = `inspection_watermark/${this.data.result}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.png`;

    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: (uploadRes) => {
        wx.hideLoading();
        this.setData({
          problemImg: uploadRes.fileID // 保存水印图片的fileID
        });
        wx.showToast({ title: '水印图片上传成功', icon: 'success' });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('水印图片上传失败：', err);
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      }
    });
  },

  // 预览水印图片
  previewImage() {
    wx.previewImage({
      current: this.data.problemImg,
      urls: [this.data.problemImg]
    });
  },

  // 删除水印图片
  deleteImage() {
    this.setData({ problemImg: '' });
  },

  // 提交巡检记录（校验水印图片必填）
  async submitRecord() {
    const { recordId, planId, result, problemDesc, problemImg } = this.data;

    // 校验必填项
    if (!problemImg) {
      wx.showToast({ title: '请上传巡检水印图片', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: {
          action: 'submitInspectionRecord',
          data: {
            recordId,
            planId,
            result,
            problemDesc: result === '异常' ? problemDesc : '无', // 正常时默认填“无”
            problemImg // 无论正常/异常都上传水印图片
          }
        }
      });

      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '提交成功', icon: 'success' });
        // 提交成功后返回记录列表页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: res.result.msg || '提交失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('提交巡检记录失败：', e);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  }
});