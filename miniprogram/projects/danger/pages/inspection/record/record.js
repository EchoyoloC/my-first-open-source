Page({
  data: {
    planId: '',
    loading: true,
    recordList: []
  },

  onLoad(options) {
    // 获取从计划列表页传过来的planId
    const planId = options.planId;
    if (!planId) {
      wx.showToast({ title: '未获取到巡检计划ID', icon: 'none' });
      wx.navigateBack();
      return;
    }

    this.setData({ planId });
    this.getInspectionRecordList();
  },

  // 页面显示时重新加载数据（确保返回后看到最新状态）
  onShow() {
    if (this.data.planId) {
      this.getInspectionRecordList();
    }
  },

  // 获取指定计划的巡检记录（关联器材详情）
  async getInspectionRecordList() {
    try {
      wx.showLoading({ title: '加载巡检记录...', mask: true });
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: {
          action: 'getInspectionRecordList',
          id: this.data.planId
        }
      });
  
      // 预处理数据，为每条记录添加格式化后的时间字符串
      const rawList = res.result.data || [];
      const processedList = rawList.map(item => {
        let inspectTimeStr = '';
        if (item.inspectTime) {
          const date = new Date(item.inspectTime);
          if (!isNaN(date.getTime())) {
            inspectTimeStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          }
        }
        return {
          ...item,
          inspectTimeStr: inspectTimeStr
        };
      });
  
      wx.hideLoading();
      this.setData({
        recordList: processedList,
        loading: false
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ loading: false });
      console.error('获取巡检记录失败：', e);
      wx.showToast({ title: '加载记录失败', icon: 'none' });
    }
  },
  // 跳转到填写巡检记录页
  goToFillRecord(e) {
    const recordId = e.currentTarget.dataset.recordid;
    const planId = e.currentTarget.dataset.planid;
    
    // 校验参数，避免空值跳转
    if (!recordId || !planId) {
      wx.showToast({ title: '参数异常，无法填写记录', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/projects/danger/pages/inspection/fill/fill?recordId=${recordId}&planId=${planId}`
    });
  },

  // 格式化日期（兼容不同格式的时间戳/字符串）
  formatDate(dateStr) {
    if (!dateStr) return '未知';
    
    // 兼容时间戳格式
    let date;
    if (typeof dateStr === 'number') {
      date = new Date(dateStr);
    } else if (typeof dateStr === 'string') {
      // 兼容云数据库的时间字符串
      date = new Date(dateStr.replace(/-/g, '/'));
    } else {
      return '未知';
    }

    // 处理无效日期
    if (isNaN(date.getTime())) {
      return '未知';
    }

    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }
});