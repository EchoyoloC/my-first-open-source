Page({
  data: {
    oldEquipmentId: '',
    oldEquipment: {},
    newEquipment: {}
  },

  onLoad(options) {
    const equipmentId = options.equipmentId;
    if (!equipmentId) {
      wx.showToast({ title: '未获取到待替换器材ID', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.setData({ oldEquipmentId: equipmentId });
    this.getOldEquipmentInfo();
  },

  onShow() {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage?.route.includes('select-equipment')) {
      const selected = prevPage.data.selectedEquipments || [];
      if (selected.length > 0) {
        this.setData({ newEquipment: selected[0] });
      }
    }
  },

  async getOldEquipmentInfo() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'getEquipmentDetail', id: this.data.oldEquipmentId }
      });
      this.setData({ oldEquipment: res.result.data || {} });
    } catch (e) {
      wx.showToast({ title: '加载失败：' + e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  selectNewEquipment() {
    wx.navigateTo({
      url: '/projects/danger/pages/inspection/select-equipment/select-equipment?singleSelect=true'
    });
  },

  async submitReplace() {
    const { oldEquipmentId, newEquipment } = this.data;
    if (!oldEquipmentId || !newEquipment._id) {
      wx.showToast({ title: '请选择新器材', icon: 'none' });
      return;
    }

    // 直接复用新器材录入时的过期时间
    const newExpireTime = newEquipment.EQ_EXPIRE_DATE;
    if (!newExpireTime) {
      wx.showToast({ title: '新器材未设置有效期，无法替换', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '替换中...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: {
          action: 'replaceExpiredEquipment',
          data: {
            oldEquipmentId,
            newEquipmentId: newEquipment._id,
            newExpireTime, // 复用新器材的过期时间
            replaceTime: new Date()
          }
        }
      });

      if (res.result.code === 0) {
        wx.showToast({ title: '替换成功！', icon: 'success' });
        setTimeout(() => wx.navigateBack({ delta: 2 }), 1500);
      } else {
        wx.showToast({ title: res.result.msg || '替换失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '替换失败：' + e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '日期错误' : `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }
});