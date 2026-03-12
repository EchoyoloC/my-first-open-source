Page({
  data: {
    expireList: [],
    unreadCount: 0
  },

  onLoad(options) {
    this.getExpireEquipment();
  },

  onShow() {
    this.getExpireEquipment();
  },

  async getExpireEquipment() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'getExpireEquipment' }
      });

      let expireList = res.result?.data || [];
      if (!Array.isArray(expireList)) expireList = [];
      const unreadCount = expireList.filter(item => !item.isRead).length;

      this.setData({ expireList, unreadCount }, () => {
        console.log('消息列表刷新完成，未读数：', unreadCount);
      });
    } catch (e) {
      wx.showToast({ title: '加载失败：' + e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async goToEquipmentDetail(e) {
    console.log('详情事件触发：', e);
    const item = e.currentTarget.dataset.item;
    const id = item?._id;

    if (!id) {
      wx.showToast({ title: '未获取到器材ID', icon: 'none' });
      return;
    }

    if (item.isRead) {
      this.navigateToDetail(id);
      return;
    }

    wx.showLoading({ title: '处理中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'markAsRead', id: id }
      });

      if (res.result.code === 0) {
        await this.getExpireEquipment();
        this.navigateToDetail(id);
      } else {
        wx.showToast({ title: res.result.msg || '标记失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '操作失败：' + e.message, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  navigateToDetail(id) {
    wx.navigateTo({
      url: `/projects/danger/pages/equipment/detail/detail?id=${id}`,
      fail: (err) => {
        console.error('详情跳转失败：', err);
        wx.showToast({ title: '跳转失败：' + err.errMsg, icon: 'none', duration: 3000 });
      }
    });
  },

  // 核心修复：确保按钮点击必触发此方法
  goToReplace(e) {
    console.log('替换按钮点击触发：', e); // 关键日志
    const equipmentId = e.currentTarget.dataset.id;

    if (!equipmentId) {
      wx.showToast({ title: '未获取到器材ID', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/projects/danger/pages/equipment/replace/replace?equipmentId=${equipmentId}`,
      fail: (err) => {
        console.error('替换页跳转失败：', err);
        wx.showToast({ title: '跳转失败：' + err.errMsg, icon: 'none', duration: 3000 });
      }
    });
  },

  // 移除无用的 stopPropagation 函数（已用原生 catchtap="" 替代）
  formatDate(dateStr) {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '日期格式错误';
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }
});