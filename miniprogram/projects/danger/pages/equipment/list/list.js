Page({
  data: {
    loading: true,
    equipmentList: [], // 原始所有器材数据
    filteredList: [],  // 最终显示的过滤后数据
    searchKey: '',     // 搜索关键词
    activeStatus: ''   // 选中的状态（''=全部，'正常'/'即将过期'/'已过期'）
  },

  onLoad() {
    this.getAllEquipment();
  },

  onShow() {
    this.getAllEquipment();
  },

  // 查询所有器材（含未过期）
  async getAllEquipment() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: {
          action: 'getAllEquipment'
        }
      });

      if (res.result.code === 0) {
        const equipmentList = res.result.data || [];
        this.setData({
          equipmentList,
          loading: false
        }, () => {
          // 数据加载完成后，执行首次过滤
          this.doFilter();
        });
      } else {
        wx.showToast({ title: res.result.msg || '查询失败', icon: 'none' });
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error('查询器材列表失败：', e);
      wx.showToast({ title: '查询失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 搜索输入事件
  onSearchInput(e) {
    const searchKey = e.detail.value.trim().toLowerCase();
    this.setData({ searchKey }, () => {
      this.doFilter(); // 输入后重新过滤
    });
  },

  // 状态切换事件
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ activeStatus: status }, () => {
      this.doFilter(); // 切换状态后重新过滤
    });
  },

  // 核心：执行双重过滤（搜索+状态）
  doFilter() {
    const { equipmentList, searchKey, activeStatus } = this.data;
    let result = [...equipmentList];

    // 第一步：状态筛选
    if (activeStatus) {
      result = result.filter(item => item.EQ_STATUS === activeStatus);
    }

    // 第二步：关键词搜索（不区分大小写）
    if (searchKey) {
      result = result.filter(item => {
        const name = (item.EQ_NAME || '').toLowerCase();
        const code = (item.EQ_CODE || '').toLowerCase();
        const location = (item.EQ_LOCATION || '').toLowerCase();
        return name.includes(searchKey) || code.includes(searchKey) || location.includes(searchKey);
      });
    }

    // 更新显示列表
    this.setData({ filteredList: result });
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/projects/danger/pages/equipment/detail/detail?id=${id}`
    });
  }
});