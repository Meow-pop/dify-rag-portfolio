# Dify RAG Portfolio

一个面向 AI 应用开发岗位的可复现作品集项目：在本地部署 Dify，并逐步实现带引用、可评测、可通过 API 调用的企业知识库助手。

## 项目目标

- 使用 Docker Compose 在 Windows + WSL 2 上部署 Dify
- 支持云端模型与 Ollama 本地模型切换
- 构建文档导入、检索、重排、生成和引用溯源链路
- 用固定测试集评估检索与回答质量
- 记录架构选择、性能数据、问题定位和改进过程

## 当前里程碑

- [x] 建立独立作品集仓库
- [x] 添加环境预检与 Dify 初始化脚本
- [x] 启动并验证 Dify 1.16.1
- [ ] 配置首个模型供应商
- [ ] 建立示例知识库
- [ ] 创建带引用的 RAG 工作流
- [ ] 增加自动导入和评测代码
- [ ] 整理架构图、演示截图和基准报告

## 快速开始

要求：Windows 10/11、Docker Desktop、WSL 2、Git，以及至少 8 GB 可供 Docker 使用的内存。

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Test-Prerequisites.ps1
.\scripts\Initialize-Dify.ps1
.\scripts\Start-Dify.ps1
```

启动完成后访问：<http://localhost>

停止服务：

```powershell
.\scripts\Stop-Dify.ps1
```

## 仓库结构

```text
docs/           架构说明、部署记录与技术决策
evaluation/     RAG 测试集和评测程序
sample-data/    可公开提交的演示资料
scripts/        环境检查与生命周期脚本
.runtime/       本机运行文件，不提交到 GitHub
```

## 设计原则

1. 上游 Dify 源码不复制进本仓库，而是在初始化时检出固定版本。
2. 密钥、密码、运行数据和真实业务文档永不提交。
3. 每个功能都附带可复现步骤、验证方式和已知限制。
4. 先完成小而完整的系统，再扩展 Agent、多模型路由和监控。

## 学习路线

本项目面向 AI Automation / AI 应用开发岗位，能力清单和作品集映射见 [AI Automation 岗位能力路线](docs/job-skill-roadmap.md)。

## 安全提醒

- 不要把 `.env`、API Key、数据库密码或真实公司资料提交到 GitHub。
- 当前配置只用于本机学习，不要直接暴露到公网。
- 对外部署前需要补充 HTTPS、身份认证、访问控制、备份和安全审计。

## 上游项目

- [Dify](https://github.com/langgenius/dify)
- [Dify 自托管文档](https://docs.dify.ai/getting-started/install-self-hosted/docker-compose)
