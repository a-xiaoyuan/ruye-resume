# 按岗位的示例简历。人物、学校、公司、项目全部虚构，数字只为演示写法。
# 由 gen_fixtures.py 引入，生成 fixtures/role-*.ruye.json。

def M(mid, mtype, data):
    return {"id": mid, "type": mtype, "visible": True, "data": data}

def basic(name, email, location="北京", github=None, website=None):
    d = {"name": name, "phone": "13900000000", "email": email, "location": location}
    if github: d["github"] = github
    if website: d["website"] = website
    return M("m-basic", "basic_info", d)

def intent(role, city, availability):
    return M("m-intent", "job_intention", {"role": role, "city": city, "availability": availability})

def edu(school, major, degree, start, end, highlights):
    return M("m-edu", "education", {"items": [{"id": "edu-1", "school": school, "major": major, "degree": degree, "start": start, "end": end, "highlights": highlights}]})

def skills(notes, categories=None):
    return M("m-skills", "skills", {"categories": categories or [], "notes": notes})

def exp_module(mid, mtype, items):
    return M(mid, mtype, {"items": items})

def exp(i, org, title, start, end, summary, stack, bullets):
    return {"id": f"exp-{i}", "org": org, "title": title, "start": start, "end": end, "summary": summary, "techStack": stack, "bullets": bullets}

def proj(i, name, role, start, end, summary, stack, bullets, url=None):
    p = {"id": f"proj-{i}", "name": name, "role": role, "start": start, "end": end, "summary": summary, "techStack": stack, "bullets": bullets}
    if url: p["url"] = url
    return p

def awards(items):
    return M("m-award", "award", {"items": [{"id": f"aw-{i}", "name": n, "date": d} for i, (n, d) in enumerate(items, 1)]})

def summary(text):
    return M("m-summary", "summary", {"text": text})


GO_BACKEND = ("role-go", "顾远舟-Go后端开发（示例，请替换）", "social-sans", [
    basic("顾远舟", "yuanzhou.gu@example.com", "上海", github="https://github.com/example"),
    intent("Go 后端开发工程师", "上海 / 杭州", "一个月内到岗"),
    skills([
        "熟悉 Go 语言与并发模型，理解 GMP 调度、channel 与 context 的使用场景，能用 pprof 定位 CPU 与内存热点",
        "熟悉 gRPC 与 Protobuf，有服务拆分、接口版本管理和超时重试设计经验",
        "熟悉 MySQL 与 Redis，能设计分库分表方案，处理过缓存一致性与热点 key 问题",
        "了解 Kafka、etcd 与 Kubernetes，能独立完成服务的容器化部署与灰度发布",
    ]),
    exp_module("m-work", "work", [
        exp(1, "示例云商科技有限公司", "Go 后端开发工程师", "2023-07", "至今",
            "负责交易中台的订单与库存服务，日均订单约 40 万",
            ["Go", "gRPC", "MySQL", "Redis", "Kafka"],
            ["个人职责：",
             "负责库存服务从 PHP 单体迁移到 Go 微服务，设计扣减、回补、对账三类接口",
             "维护订单状态机，处理超时关单、部分退款等异常流转",
             "工作成果：",
             "库存扣减：Redis Lua 预扣 + MySQL 异步落库，大促峰值 6000 QPS 下无超卖",
             "稳定性：引入熔断与分级降级，核心链路 P99 从 210ms 降到 85ms，全年无 P1 故障",
             "成本：合并冗余定时任务并改为事件驱动，服务器数量从 24 台降到 15 台"]),
        exp(2, "示例数据服务公司", "后端开发实习生", "2022-07", "2022-12",
            "参与日志检索平台的查询服务开发",
            ["Go", "Elasticsearch"],
            ["实现按租户隔离的查询网关，统一做鉴权、限流与慢查询记录",
             "优化分页查询为 search_after，深分页接口耗时从 3s 降到 300ms 左右"]),
    ]),
    exp_module("m-proj", "project", [
        proj(1, "轻量级分布式任务调度器", "独立开发", "2023-03", "2023-06",
             "开源学习项目，支持定时任务、失败重试与任务分片",
             ["Go", "etcd", "gRPC"],
             ["基于 etcd 租约做 leader 选举与节点心跳，节点宕机后 10 秒内完成任务重新分配",
              "实现时间轮调度，单节点稳定调度 2 万个定时任务",
              "提供命令行与 Web 控制台，补齐单元测试，覆盖率 78%"],
             url="https://github.com/example/mini-scheduler"),
    ]),
    edu("示例工业大学", "软件工程", "本科", "2019-09", "2023-06",
        ["GPA 3.6 / 4.0；主修操作系统、计算机网络、分布式系统"]),
    summary("习惯先写压测与监控再上线，线上问题会整理复盘文档。对高并发交易系统和基础设施方向都有兴趣。"),
])

FRONTEND = ("role-frontend", "温以宁-前端开发（示例，请替换）", "classic", [
    basic("温以宁", "yining.wen@example.com", "杭州", github="https://github.com/example", website="https://example.com"),
    intent("前端开发工程师", "杭州", "2027 届校招，可提前实习"),
    edu("示例师范大学", "计算机科学与技术", "本科", "2023-09", "2027-06",
        ["GPA 3.8 / 4.0，专业前 5%；校前端技术社团负责人"]),
    skills([
        "熟悉 TypeScript 与 React，理解 Hooks 依赖与重渲染机制，能用 Profiler 定位性能问题",
        "熟悉 CSS 布局与响应式设计，了解浏览器渲染流程，做过首屏与长列表性能优化",
        "熟悉 Vite、Webpack 的配置与插件机制，了解 Node.js 与前端工程化",
        "了解 Web Worker、WebAssembly 与可访问性（WAI-ARIA）",
    ]),
    exp_module("m-intern", "internship", [
        exp(1, "示例在线教育公司", "前端开发实习生", "2026-06", "2026-09",
            "参与课程后台与学员端 H5 的开发",
            ["React", "TypeScript", "Ant Design"],
            ["个人职责：",
             "负责课程编辑器的章节拖拽排序与自动保存，处理离线编辑与冲突提示",
             "将学员端 H5 的图片资源改为按需加载与 WebP 格式",
             "工作成果：",
             "首屏性能：拆分路由与第三方库，首屏 JS 从 1.2MB 降到 420KB，LCP 从 3.1s 降到 1.6s",
             "质量：为编辑器补充 60 余个组件测试，相关线上问题从每周 5 个降到 1 个以内"]),
    ]),
    exp_module("m-proj", "project", [
        proj(1, "所见即所得的简历编辑器", "独立开发", "2026-03", "2026-06",
             "浏览器内实时预览、导出 PDF 的简历工具，本地优先，无需登录",
             ["React", "TypeScript", "Web Worker"],
             ["排版放进 Web Worker，连续输入时只排最新一版，主线程不再卡顿",
              "实现撤销重做与本地自动保存，存档损坏时可下载原始数据，不覆盖",
              "完成键盘可操作与读屏标注，Lighthouse 可访问性评分 100"],
             url="https://github.com/example/resume-editor"),
        proj(2, "校园活动报名小程序", "前端负责人", "2025-09", "2025-12",
             "四人小组课程项目，上线后服务 3 个学院的活动报名",
             ["微信小程序", "TypeScript"],
             ["设计报名表单的配置化渲染，新增活动无需改代码",
              "长列表改为虚拟滚动，千条数据滚动保持流畅"]),
    ]),
    awards([("中国大学生计算机设计大赛 省级一等奖", "2026-05"), ("校级优秀学生干部", "2025-06")]),
])

TEST_DEV = ("role-testdev", "邵明川-测试开发（示例，请替换）", "minimal", [
    basic("邵明川", "mingchuan.shao@example.com", "深圳", github="https://github.com/example"),
    intent("测试开发工程师", "深圳 / 广州", "2027 届校招"),
    edu("示例电子科技大学", "软件工程", "本科", "2023-09", "2027-06",
        ["GPA 3.5 / 4.0；主修软件测试、软件工程、数据库原理"]),
    skills([
        "熟悉 Python 与 Java，能独立编写接口与 UI 自动化测试，熟悉 pytest、JUnit 5 与 Playwright",
        "熟悉测试用例设计方法（等价类、边界值、状态迁移），能根据需求文档梳理测试点",
        "熟悉 Linux 常用命令与 MySQL，能通过日志与慢查询定位问题",
        "了解 JMeter 性能测试、Jenkins 与 GitHub Actions 持续集成",
    ]),
    exp_module("m-intern", "internship", [
        exp(1, "示例支付科技公司", "测试开发实习生", "2026-07", "2026-10",
            "负责商户结算模块的测试",
            ["Python", "pytest", "MySQL", "Jenkins"],
            ["个人职责：",
             "梳理结算规则的测试点，编写接口自动化用例 320 条，接入每日构建",
             "设计金额计算的边界数据集，覆盖多币种、跨日结算和退款冲正",
             "工作成果：",
             "提效：回归测试从人工 2 天缩短到自动化 25 分钟",
             "质量：提测前发现 14 个缺陷，其中 3 个会导致结算金额错误"]),
    ]),
    exp_module("m-proj", "project", [
        proj(1, "接口自动化测试平台", "独立开发", "2026-03", "2026-06",
             "支持用例管理、数据驱动、定时执行和测试报告",
             ["Python", "FastAPI", "Vue", "MySQL"],
             ["用例与数据分离，一条用例可按数据集展开执行",
              "执行结果对比上一次运行，自动标出新增失败与恢复的用例",
              "接入飞书机器人推送报告，失败用例附带请求与响应快照"]),
        proj(2, "在线商城 UI 自动化", "测试负责人", "2025-10", "2025-12",
             "课程项目，使用 Playwright 编写端到端测试",
             ["Playwright", "TypeScript"],
             ["采用页面对象模式组织用例，40 条主流程用例可在 CI 中并行执行",
              "通过请求拦截构造异常场景，覆盖支付失败、库存不足等分支"]),
    ]),
    summary("关注「怎么让问题更早被发现」：习惯把发现的缺陷沉淀成自动化用例，避免同类问题再出现。"),
])

ALGORITHM = ("role-algo", "何清越-算法工程师（示例，请替换）", "elegant", [
    basic("何清越", "qingyue.he@example.com", "北京", github="https://github.com/example"),
    intent("算法工程师（大模型应用方向）", "北京", "2027 届校招"),
    edu("示例科技大学", "人工智能", "硕士", "2024-09", "2027-06",
        ["研究方向：检索增强生成与大模型评测；GPA 3.8 / 4.0"]),
    M("m-edu2", "research", {"items": [
        {"id": "rs-1", "name": "面向长文档问答的检索增强方法", "org": "自然语言处理实验室", "start": "2025-03", "end": "2026-06",
         "bullets": ["提出按章节层级召回再重排的检索策略，在自建长文档问答集上答案准确率提升 6.4 个百分点",
                     "构建 3000 条人工标注的评测集，设计忠实度与引用准确率两项指标",
                     "论文以第一作者投稿至国内 NLP 会议，在审"]}]}),
    skills([
        "熟悉 PyTorch 与 Transformers，有 LoRA 微调与 vLLM 推理部署经验",
        "熟悉检索增强生成的完整链路：切分、向量化、召回、重排与评测",
        "熟悉常用机器学习算法与评估方法，能设计离线评测并分析错误案例",
        "了解 CUDA 基础与分布式训练（DeepSpeed ZeRO）",
    ]),
    exp_module("m-intern", "internship", [
        exp(1, "示例智能科技公司", "算法实习生", "2026-06", "2026-09",
            "参与企业知识库问答系统",
            ["Python", "PyTorch", "vLLM", "Milvus"],
            ["召回优化：引入混合检索与重排模型，Top-5 召回率从 71% 提升到 86%",
             "微调：用 1.2 万条业务问答对 7B 模型做 LoRA 微调，拒答准确率提升 12 个百分点",
             "评测：搭建自动评测流水线，每次模型更新 20 分钟内出报告"]),
    ]),
    awards([("天池大模型应用挑战赛 季军", "2025-11"), ("研究生国家奖学金", "2025-10")]),
])

PRODUCT = ("role-pm", "许知微-产品经理（示例，请替换）", "timeline", [
    basic("许知微", "zhiwei.xu@example.com", "北京"),
    intent("产品经理（B 端 / SaaS）", "北京", "2027 届校招，可提前实习"),
    exp_module("m-intern", "internship", [
        exp(1, "示例企业服务公司", "产品经理实习生", "2026-06", "2026-09",
            "负责协同办公产品的审批模块",
            ["用户访谈", "Axure", "SQL"],
            ["需求调研：访谈 12 家客户的行政与财务人员，归纳出审批流配置难、催办靠人工两个核心问题",
             "方案设计：设计审批流模板与自动催办规则，输出 PRD 与原型，推动研发两周上线",
             "效果：新客户审批流配置时间从平均 40 分钟降到 10 分钟，审批平均时长缩短 35%"]),
        exp(2, "示例内容社区", "产品运营实习生", "2025-12", "2026-03",
            "负责新用户留存",
            ["数据分析", "A/B 测试"],
            ["通过漏斗分析发现新用户在兴趣选择页流失最多，推动简化为一步选择",
             "设计并跟进 3 组 A/B 实验，新用户次日留存提升 4.2 个百分点"]),
    ]),
    exp_module("m-proj", "project", [
        proj(1, "校园二手交易平台", "产品负责人", "2025-03", "2025-06",
             "五人团队课程项目，上线一学期累计注册 1800 人",
             ["Figma", "问卷调研"],
             ["通过 200 份问卷确定「担保交易」与「宿舍楼自提」两个差异化功能",
              "制定版本节奏与验收标准，按两周一个版本完成 4 次迭代"]),
    ]),
    edu("示例财经大学", "信息管理与信息系统", "本科", "2023-09", "2027-06",
        ["GPA 3.7 / 4.0；辅修心理学"]),
    skills([
        "熟悉需求调研、PRD 撰写与原型设计，能把模糊需求拆成可验收的功能点",
        "能使用 SQL 与 Excel 做数据分析，熟悉漏斗、留存与 A/B 测试的分析方法",
        "了解前后端基本原理，能和研发讨论技术方案与排期",
    ]),
    summary("相信好的需求来自现场：做方案前会先去看用户怎么用，上线后跟踪数据并复盘。"),
])

ROLE_SAMPLES = [GO_BACKEND, FRONTEND, TEST_DEV, ALGORITHM, PRODUCT]
