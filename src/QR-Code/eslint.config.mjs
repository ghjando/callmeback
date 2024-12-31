import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // 添加 Node.js 全局变量
      }
    },
    rules: {
      'no-console': 'off', // 将 console.log() 的使用设置为警告
      'eqeqeq': ['error', 'always'], // 强制使用 === 和 !==
      'curly': 'error', // 强制使用大括号
      'quotes': ['error', 'single'], // 强制使用单引号
      'semi': ['error', 'always'], // 强制使用分号
      'no-prototype-builtins': 'off', // 确保该规则被启用
      //'indent': ['error', 2], // 强制使用 2 个空格缩进
    }
  }
];