Page({
  data: {
    planList: []
  },

  onLoad() {
    this.getInspectionPlanList();
  },

  onShow() {
    this.getInspectionPlanList();
  },

  async getInspectionPlanList() {
    try {
      wx.showLoading({ title: '加载中...' });
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'getInspectionPlanList' }
      });

      // 直接处理数据，不依赖复杂计算
      const planList = res.result.data || [];
      
      // 预处理时间，确保界面有显示
      const processedList = planList.map(plan => {
        // 优先显示巡检时间，没有则显示创建时间
        let timeStr = '未设置';
        if (plan.inspectTime) {
          timeStr = this.formatDate(plan.inspectTime);
        } else if (plan.createTime) {
          timeStr = this.formatDate(plan.createTime);
        }
        return {
          ...plan,
          displayTime: timeStr // 新增一个字段给 WXML 用
        };
      });

      this.setData({
        planList: processedList
      });
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      console.error('获取计划失败：', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goToCreatePlan() {
    wx.navigateTo({
      url: "/projects/danger/pages/inspection/create/create"
    });
  },

  goToRecordList(e) {
    const planId = e.currentTarget.dataset.planid;
    wx.navigateTo({
      url: `/projects/danger/pages/inspection/record/record?planId=${planId}`
    });
  },

  // 优化后的日期格式化，更稳健
  formatDate(dateStr) {
    if (!dateStr) return '未知';
    
    // 兼容云数据库时间对象
    let date;
    if (dateStr.__date__) {
      date = new Date(dateStr.__date__);
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
      return '未知';
    }
    
    // 补零函数
    const addZero = (num) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${addZero(date.getMonth()+1)}-${addZero(date.getDate())}`;
  }
});