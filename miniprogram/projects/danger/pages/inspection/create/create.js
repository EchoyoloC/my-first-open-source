Page({
  data: {
    selectedMonth: '', // 选中的月份（格式：2026-03）
    selectedEquipments: [], // 选中的器材列表
    allEquipments: [] // 所有器材（用于选择）
  },

  onLoad() {
    this.getAllEquipments();
  },

  // 获取所有器材
  async getAllEquipments() {
    try {
      wx.showLoading({ title: '加载器材列表...' });
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'getAllEquipment' }
      });
  
      wx.hideLoading();
      console.log('获取到的器材列表：', res.result.data); // 新增日志
      this.setData({
        allEquipments: res.result.data || []
      }, () => {
        console.log('设置到页面的 allEquipments：', this.data.allEquipments); // 新增日志
      });
    } catch (e) {
      wx.hideLoading();
      console.error('获取器材列表失败：', e);
      wx.showToast({ title: '加载器材失败', icon: 'none' });
    }
  },

  // 选择月份
  onMonthChange(e) {
    const date = e.detail.value;
    const month = date.substring(0, 7); // 提取年月：2026-03
    this.setData({ selectedMonth: month });
  },

  // 选择器材（跳转到独立选择页）
  selectEquipment() {
    const { selectedEquipments } = this.data;
    const preSelectedIds = selectedEquipments.map(item => item._id);
  
    wx.navigateTo({
      // 直接传递 JSON 字符串，不再进行 URI 编码
      url: `/projects/danger/pages/inspection/select-equipment/select-equipment?preSelectedIds=${JSON.stringify(preSelectedIds)}`
    });
  },

  // 移除选中的器材
  removeEquipment(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      selectedEquipments: this.data.selectedEquipments.filter(item => item._id !== id)
    });
  },

  // 提交创建计划
  async submitPlan() {
    const { selectedMonth, selectedEquipments } = this.data;
    const equipmentIds = selectedEquipments.map(item => item._id);

    try {
      wx.showLoading({ title: '创建中...' });
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: {
          action: 'createInspectionPlan',
          data: {
            month: selectedMonth,
            equipmentIds
          }
        }
      });

      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '创建成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack(); // 返回计划列表页
        }, 1500);
      } else {
        wx.showToast({ title: res.result.msg || '创建失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('创建计划失败：', e);
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  }
});