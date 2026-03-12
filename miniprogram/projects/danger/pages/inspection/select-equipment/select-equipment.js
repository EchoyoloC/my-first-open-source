Page({
  data: {
    allEquipments: [],
    filteredList: [],
    selectedIds: [],
    selectedEquipments: [],
    searchKey: '',
    singleSelect: false
  },

  onLoad(options) {
    this.setData({
      singleSelect: options.singleSelect === 'true'
    });
    const preSelectedIds = options.preSelectedIds ? JSON.parse(options.preSelectedIds) : [];
    this.setData({ selectedIds: preSelectedIds });
    this.getAllEquipments();
  },

  onUnload() {
    if (this.data.singleSelect) {
      this.setData({ selectedEquipments: [], selectedIds: [] });
    }
  },

  async getAllEquipments() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      // 1. 获取所有器材
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'getAllEquipment' }
      });
      let allEquipments = res.result.data || [];

      // 🌟 核心：获取已被替换占用的新器材ID列表
      const usedRes = await wx.cloud.callFunction({
        name: 'equipment',
        data: { action: 'getUsedNewEquipmentIds' }
      });
      const usedNewEquipmentIds = usedRes.result.data || [];
      console.log('已被占用的新器材ID：', usedNewEquipmentIds);

      // 🌟 核心过滤规则：仅保留「未过期 + 未被占用」的器材
      allEquipments = allEquipments.filter(item => {
        // 过滤条件1：状态不是「已过期/即将过期」
        const isNotExpired = !['已过期', '即将过期'].includes(item.EQ_STATUS);
        // 过滤条件2：未被其他旧器材替换占用
        const isNotUsed = !usedNewEquipmentIds.includes(item._id);
        // 过滤条件3：状态不是「已替换/已占用」
        const isNotOccupied = !['已替换', '已占用'].includes(item.EQ_STATUS);
        return isNotExpired && isNotUsed && isNotOccupied;
      });

      // 初始化 checked 字段
      const filteredList = allEquipments.map(item => ({
        ...item,
        checked: this.data.selectedIds.includes(item._id)
      }));

      this.setData({
        allEquipments,
        filteredList
      });
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      console.error('获取器材失败：', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onSearchInput(e) {
    const searchKey = e.detail.value.trim().toLowerCase();
    const { allEquipments, selectedIds } = this.data;

    if (!searchKey) {
      const fullList = allEquipments.map(item => ({
        ...item,
        checked: selectedIds.includes(item._id)
      }));
      this.setData({ filteredList: fullList, searchKey: '' });
      return;
    }

    const filteredList = allEquipments
      .filter(item => {
        const name = (item.EQ_NAME || '').toLowerCase();
        const code = (item.EQ_CODE || '').toLowerCase();
        return name.includes(searchKey) || code.includes(searchKey);
      })
      .map(item => ({
        ...item,
        checked: selectedIds.includes(item._id)
      }));

    this.setData({ filteredList, searchKey });
  },

  selectEquipment(e) {
    const id = e.currentTarget.dataset.id;
    const { filteredList, singleSelect, selectedIds } = this.data;

    let newSelectedIds;
    if (singleSelect) {
      newSelectedIds = [id];
    } else {
      newSelectedIds = selectedIds.includes(id)
        ? selectedIds.filter(item => item !== id)
        : [...selectedIds, id];
    }

    const newFilteredList = filteredList.map(item => ({
      ...item,
      checked: newSelectedIds.includes(item._id)
    }));
    const newSelectedEquipments = newFilteredList.filter(item => item.checked);

    this.setData({
      selectedIds: newSelectedIds,
      selectedEquipments: newSelectedEquipments,
      filteredList: newFilteredList
    }, () => {
      if (singleSelect) {
        console.log('✅ 单选模式：已选中新器材：', newSelectedEquipments);
        const pages = getCurrentPages();
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i].route.includes('equipment/replace/replace')) {
            pages[i].setData({ newEquipment: newSelectedEquipments[0] });
            break;
          }
        }
        setTimeout(() => wx.navigateBack(), 500);
      } else {
        console.log('✅ 多选模式：当前选中', newSelectedEquipments.length, '个器材');
      }
    });
  },

  confirmSelect() {
    const { selectedEquipments, singleSelect } = this.data;
    if (singleSelect) return;

    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage) {
      prevPage.setData({ selectedEquipments });
    }
    wx.navigateBack();
  }
});