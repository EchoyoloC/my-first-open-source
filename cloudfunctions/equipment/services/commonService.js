// src/services/commonService.js（微信云开发版）
const Joi = require('joi');

// 1. 参数校验（逻辑不变，简化日志）
const validateParams = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  if (error) {
    const errMsg = error.details.map(item => item.message).join('；');
    console.error(`参数校验失败：${errMsg}`); // 微信云函数控制台会捕获console日志
    throw new Error(`参数错误：${errMsg}`);
  }
  return value;
};

// 2. 异步异常包装（逻辑不变）
const wrapAsync = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`业务执行异常：${error.stack}`);
      throw error;
    }
  };
};

module.exports = {
  validateParams,
  wrapAsync
};