Page({
  data: {
    loading: true,
    equipment: {},
  },

  onLoad(options) {
    // console.log('详情页 onLoad 收到参数：', options);
    const equipmentId = options.id;
    if (equipmentId) {
      // console.log('开始查询器材ID：', equipmentId);
      this.getEquipmentDetail(equipmentId);
    } else {
      this.setData({ loading: false });
      wx.showToast({ title: '未获取到器材ID', icon: 'none' });
    }
  },

  async getEquipmentDetail(id) {
    try {
      // console.log('调用云函数 equipment，action: getEquipmentDetail，id:', id);
      const res = await wx.cloud.callFunction({
        name: 'equipment',
        data: {
          action: 'getEquipmentDetail',
          id: id
        }
      });

      // console.log('云函数返回完整结果：', res);

      if (res && res.result && res.result.code === 0) {
        // console.log('云函数返回原始数据：', res.result.data);
        // 简化数据映射：无需重复赋值，直接使用原始数据
        const equipment = res.result.data || {};

        // console.log('最终渲染数据：', equipment);
        // // 打印图片字段，便于调试
        // console.log('器材图片字段值（原始fileID）：', equipment.EQ_IMG);

        // 确认数据更新
        this.setData({
          equipment,
          loading: false
        }, () => {
          // console.log('页面data更新完成，当前equipment：', this.data.equipment);
          // console.log('到期时间字段值：', this.data.equipment.EQ_EXPIRE_DATE);
          // console.log('录入时间字段值：', this.data.equipment.EQ_CREATE_TIME);
          // console.log('图片字段最终渲染值（fileID）：', this.data.equipment.EQ_IMG);
        });
      } else {
        console.error('云函数返回异常：', res.result);
        this.setData({ loading: false });
        wx.showToast({
          title: res.result?.msg || '查询失败：无数据',
          icon: 'none'
        });
      }
    } catch (e) {
      console.error('云函数调用失败：', e);
      this.setData({ loading: false });
      wx.showToast({
        title: '查询失败：' + (e.message || '网络异常'),
        icon: 'none'
      });
    }
  },

  // 优化：图片预览功能（仅保留fileID原生支持，移除多余转换）
  previewImg() {
    const { EQ_IMG } = this.data.equipment;
    // console.log('触发图片预览，原始fileID：', EQ_IMG);
    
    // 空值校验
    if (!EQ_IMG) {
      wx.showToast({ title: '暂无图片可预览', icon: 'none' });
      return;
    }

    // 核心修改：直接使用原始fileID，不做任何URL转换
    // 小程序previewImage API原生支持cloud://协议的fileID
    wx.previewImage({
      urls: [EQ_IMG], // 直接传fileID
      current: EQ_IMG, // 当前显示的fileID
      fail: (err) => {
        console.error('图片预览失败：', err);
        wx.showToast({ title: '预览失败：' + err.errMsg, icon: 'none' });
      }
    });
  },

  // 保留原有注释的formatDate函数（如需启用可取消注释）
  // formatDate(dateStr) {
  //   console.log('formatDate被调用了！入参：', dateStr); 
  //   if (!dateStr) return '未填写';
  //   const date = new Date(dateStr);
  //   if (isNaN(date.getTime())) return '无效时间';
  //   const res = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  //   console.log('formatDate返回值：', res); 
  //   return res;
  // }
});