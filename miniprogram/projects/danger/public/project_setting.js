const TASK_TYPE = ['道路状况', '照明设施', '给排水系统', '电力设施', '建筑物', '绿化景观', '消防设施', '安防监控', '环境卫生', '其他'];

module.exports = { //隐患上报 danger
	PROJECT_COLOR: '#0055BE',
	NAV_COLOR: '#ffffff',
	NAV_BG: '#0055BE',

	// setup
	SETUP_CONTENT_ITEMS: [
		{ title: '关于我们', key: 'SETUP_CONTENT_ABOUT' },
	],

	// 用户
	USER_REG_CHECK: false,
	USER_FIELDS: [

	],

	NEWS_NAME: '通知公告',
	NEWS_CATE: [
		{ id: 1, title: '通知公告', style: 'leftbig1' },
		{ id: 2, title: '安环课堂', style: 'leftbig1' },
	],
	NEWS_FIELDS: [],


	TASK_NAME: '隐患',
	TASK_TYPE: TASK_TYPE,
	TASK_FIELDS: [
		{ mark: 'type', title: '隐患类型', type: 'select', selectOptions: TASK_TYPE, must: true },
		{ mark: 'person', title: '联系人', type: 'text', must: true },
		{ mark: 'phone', title: '联系电话', type: 'text', must: true },
		{ mark: 'address', title: '隐患地点', type: 'textarea', must: true },
		{ mark: 'desc', title: '隐患详情', type: 'textarea', must: true },
		{ mark: 'img', type: 'image', title: '相关图片', max: 8 },
	],

	TASK_RUN_FIELDS: [
		{ mark: 'content', title: '情况说明', type: 'textarea', must: false },
		{ mark: 'img', type: 'image', title: '相关图片', max: 8 },
	],

	TASK_OVER_FIELDS: [
		{ mark: 'content', title: '完成情况说明', type: 'textarea', must: true },
		{ mark: 'img', type: 'image', title: '相关图片', max: 8, must: true },
	],

	TASK_COMMENT_FIELDS: [
		{ mark: 'content', title: '评价内容', type: 'textarea', must: true },
		{ mark: 'img', type: 'image', title: '相关图片', max: 8 },
	],


	MEMBER_NAME: '工作人员',
	MEMBER_CATE: [
		{ id: 1, title: '客服部' },
		{ id: 2, title: '安保部' },
		{ id: 3, title: '保洁部' },
		{ id: 4, title: '维修部' },
		{ id: 5, title: '工程部' },
	],
	MEMBER_FIELDS: [
		{ mark: 'phone', title: '服务电话', type: 'text', ext: { hint: '用于展示给上报用户' }, must: false },
		{ mark: 'img', type: 'image', title: '头像', max: 1 },
	],


}