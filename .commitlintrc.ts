export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "init",   // 用于初始化提交
        "feat",   // 用于提交新增功能
        "fix",    // 用于提交消缺和 Bug 修复
        "build",  // 用于修改项目构建系统，例如修改依赖库、外部接口或者升级 Node 版本等
        "chore",  // 用于对非业务性代码进行修改，例如修改构建流程或者工具配置等杂项
        "ci",     // 用于修改持续集成流程，例如修改 GitHub Actions、Travis、Jenkins 等工作流配置
        "docs",   // 用于修改文档，例如修改 README 文件、API 文档等
        "style",  // 用于修改样式表语言，以及修改代码样式，例如调整 CSS、Less、UnoCSS 等，以及调整代码缩进、空格、空行等
        "refactor", // 用于重构代码，例如修改代码结构、变量名、函数名等但不修改功能逻辑
        "perf",   // 用于优化性能，例如提升代码的性能、减少内存占用等
        "test",   // 用于修改测试用例，例如添加、删除、修改代码的测试用例等
        "revert", // 用于恢复代码时
        "type",   // 用于修改类型声明
        "wip",    // 用于未完全完成前临时提交
      ],
    ],
  },
};
