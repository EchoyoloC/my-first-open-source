const pageHelper = require('../../../../../helper/page_helper.js');  
const ProjectBiz = require('../../../biz/project_biz.js'); 

Page({
	/**
	 * 页面的初始数据
	 */
	data: { 
		noticeCount: 0 // 新增：过期/即将过期器材数量
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: async function (options) {
		ProjectBiz.initPage(this);
		// 加载时查询提醒数量
		await this.checkExpireNotice();
	},

	/**
	 * 生命周期函数--监听页面初次渲染完成
	 */
	onReady: function () { },

	/**
	 * 生命周期函数--监听页面显示
	 */
	onShow: async function () {  
		// 每次显示页面都刷新提醒数量
		await this.checkExpireNotice();
	},

	onPullDownRefresh: async function () { 
		// 下拉刷新时也更新提醒数量
		await this.checkExpireNotice();
		wx.stopPullDownRefresh();
	},

	/**
	 * 生命周期函数--监听页面隐藏
	 */
	onHide: function () {

	},

	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload: function () {

	}, 

	/**
	 * 新增：查询过期/即将过期器材数量（用于首页提醒）
	 */
	async checkExpireNotice() {
		try {
			// 调用equipment云函数查询异常器材
			const res = await wx.cloud.callFunction({
				name: 'equipment', // 云函数名称，确保和你部署的一致
				data: { action: 'getExpireEquipment' } // 对应云函数中查询过期器材的动作
			});

			// 处理返回结果
			if (res && res.result && res.result.code === 0) {
				const expireList = res.result.data || [];
				this.setData({
					noticeCount: expireList.length // 更新过期器材数量
				});
			}
		} catch (e) {
			// 异常处理，避免页面报错
			console.error('查询器材过期提醒失败：', e);
			// 保留原有数据，不影响页面展示
			this.setData({ noticeCount: this.data.noticeCount || 0 });
		}
	},

	/**
	 * 新增：跳转到消息中心页面
	 */
  goToMessage() {
    console.log('点击了提醒栏，准备跳转消息中心'); // 调试日志
    wx.navigateTo({
      url: '/projects/danger/pages/message/message', // 确认路径
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败：', err); // 打印错误原因
        wx.showToast({
          title: '跳转失败：' + err.errMsg,
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

	url: async function (e) {
		pageHelper.url(e, this);
	},

	/**
	 * 用户点击右上角分享
	 */
	onShareAppMessage: function () {

	},
})