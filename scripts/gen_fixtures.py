# 生成 fixtures/*.ruye.json。人物与经历均为虚构示例。
# 用法：python3 scripts/gen_fixtures.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from role_samples import ROLE_SAMPLES

ROOT = pathlib.Path(__file__).resolve().parent.parent

def doc(title, modules, template="campus-serif"):
    return {"version": 1,
            "meta": {"title": title, "locale": "zh-CN", "updatedAt": "2026-11-15T00:00:00.000Z"},
            "layout": {"templateId": template, "pageMode": "fit-a4"},
            "modules": modules}

basic = {"id": "m-basic", "type": "basic_info", "visible": True, "data": {
    "name": "林知夏", "phone": "13800000000", "email": "zhixia.lin@example.com",
    "location": "天津", "github": "https://github.com/example"}}
intent = {"id": "m-intent", "type": "job_intention", "visible": True, "data": {
    "role": "Java 后端实习生", "city": "天津 / 北京", "availability": "2027 年暑期实习，可实习 6 个月"}}
edu = {"id": "m-edu", "type": "education", "visible": True, "data": {"items": [
    {"id": "edu-1", "school": "示例理工大学", "degree": "本科", "major": "网络工程",
     "start": "2024-09", "end": "2028-06",
     "highlights": ["GPA 3.7 / 4.0（专业前 10%），连续两年获校级一等奖学金",
                    "主修课程：计算机网络、操作系统、数据结构、数据库系统原理"]}]}}
skills_short = {"id": "m-skills", "type": "skills", "visible": True, "data": {"categories": [
    {"id": "sk-1", "name": "语言", "items": ["Java", "Python", "SQL"]},
    {"id": "sk-2", "name": "框架", "items": ["Spring Boot", "MyBatis", "Spring Cloud Gateway"]},
    {"id": "sk-3", "name": "中间件", "items": ["MySQL", "Redis", "RabbitMQ"]}]}}

def exp(i, org, title, start, end, summary, stack, bullets):
    return {"id": f"exp-{i}", "org": org, "title": title, "start": start, "end": end,
            "summary": summary, "techStack": stack, "bullets": bullets}

intern1 = exp(1, "示例科技有限公司", "后端开发实习生", "2026-07", "2026-09", "电商订单与优惠券服务",
              ["Java", "Spring Boot", "Redis", "MySQL"],
              ["参与订单查询接口优化，引入二级缓存与索引调整，将 P99 延迟从 320ms 降到 140ms",
               "补齐优惠券核销链路的单元测试，核心路径覆盖率从 52% 提升至 85%",
               "排查一次连接池耗尽引发的线上告警，定位到慢 SQL 并推动修复"])
intern2 = exp(2, "示例云计算公司", "平台研发实习生", "2026-10", "至今", "统一认证与 API 网关接入",
              ["Java", "Spring Cloud Gateway", "OAuth 2.0", "Nacos"],
              ["负责三个内部系统接入统一认证，基于 OAuth 2.0 授权码模式完成单点登录改造",
               "在网关层实现基于令牌的鉴权过滤器，统一处理过期、刷新与权限不足的返回码",
               "整理接入文档与排障手册，新系统接入时间从约 3 天缩短到半天"])

def proj(i, name, role, start, end, url, summary, stack, bullets):
    p = {"id": f"proj-{i}", "name": name, "role": role, "start": start, "end": end,
         "summary": summary, "techStack": stack, "bullets": bullets}
    if url: p["url"] = url
    return p

proj1 = proj(1, "如页简历编辑器", "独立开发", "2026-11", "至今", "https://github.com/example/ruye-resume",
             "本地优先的中文简历编辑器", ["TypeScript", "React", "Typst"],
             ["设计浏览器内的 A4 智能一页与无损长一页导出，预览与 PDF 使用同一套排版结果",
              "实现收紧算法：按间距、紧凑变体、行距、字号的顺序逐步收紧，装不下时给出溢出报告"])
proj2 = proj(2, "校园二手交易平台", "后端负责人", "2025-03", "2025-06", None,
             "课程设计，三人小组", ["Java", "Spring Boot", "MySQL", "Redis"],
             ["设计商品、订单、消息三张核心表，使用乐观锁解决并发下单导致的超卖问题",
              "基于 Redis 实现热门商品排行与浏览计数，接口平均响应时间降低约 40%",
              "编写 JMeter 压测脚本，单机 QPS 从 600 提升到 1500"])
proj3 = proj(3, "分布式日志采集工具", "独立开发", "2025-09", "2025-12", None,
             "面向小型团队的日志采集与检索", ["Go", "Kafka", "Elasticsearch"],
             ["实现基于文件偏移量的断点续传，进程重启后日志不丢失、不重复",
              "按服务名与时间分片写入 Elasticsearch，支持关键字检索与按级别过滤",
              "提供命令行工具，支持按 traceId 聚合同一请求的跨服务日志",
              "编写 Docker Compose 一键部署脚本与使用文档"])
proj4 = proj(4, "简易 RPC 框架", "独立开发", "2025-06", "2025-08", None,
             "学习型项目，参考主流 RPC 设计自行实现", ["Java", "Netty", "ZooKeeper"],
             ["基于 Netty 实现自定义协议的编解码，处理粘包拆包",
              "使用 ZooKeeper 做服务注册与发现，支持随机与轮询两种负载均衡策略",
              "通过 SPI 机制支持 JSON 与 Hessian 两种序列化方式切换"])
award = {"id": "m-award", "type": "award", "visible": True, "data": {"items": [
    {"id": "aw-1", "name": "全国大学生数学建模竞赛 省级二等奖", "date": "2025-11"},
    {"id": "aw-2", "name": "校级优秀学生干部", "date": "2025-06"}]}}
award_long = {"id": "m-award", "type": "award", "visible": True, "data": {"items": award["data"]["items"] + [
    {"id": "aw-3", "name": "蓝桥杯 Java 软件开发 省级一等奖", "date": "2026-04"},
    {"id": "aw-4", "name": "校级一等奖学金（两次）", "date": "2026-09", "description": "专业排名前 5%"}]}}
research = {"id": "m-research", "type": "research", "visible": True, "data": {"items": [
    {"id": "rs-1", "name": "校园网流量异常检测", "org": "网络安全实验室", "start": "2025-10", "end": "2026-06",
     "bullets": ["采集校园网出口流量并提取统计特征，构建约 20 万条样本的数据集",
                 "对比孤立森林与自编码器两种方法，在测试集上 F1 达到 0.91",
                 "整理实验结果并撰写校级大创项目结题报告"]}]}}
skills_long = {"id": "m-skills", "type": "skills", "visible": True, "data": {"categories":
    skills_short["data"]["categories"] + [
    {"id": "sk-4", "name": "工具", "items": ["Git", "Docker", "Linux", "JMeter", "Arthas"]},
    {"id": "sk-5", "name": "基础", "items": ["熟悉 JVM 内存模型与常见 GC 调优", "理解 TCP/IP 与 HTTP/2", "熟悉常见设计模式"]}]}}

# 混合写法：先列分类，再用描述句写深度（长样本用）
skills_mixed = {"id": "m-skills", "type": "skills", "visible": True, "data": {
    "categories": skills_long["data"]["categories"][:4],
    "notes": ["熟悉 Java 集合与并发编程，理解 AQS、线程池的工作原理",
              "熟悉 MySQL 索引与事务隔离级别，有慢 SQL 定位与调优经验",
              "JVM：了解内存模型与常见 GC 收集器，能用 Arthas 排查线上问题"]}}

def internship(items):
    return {"id": "m-intern", "type": "internship", "visible": True, "data": {"items": items}}
def projects(items):
    return {"id": "m-proj", "type": "project", "visible": True, "data": {"items": items}}


# 完整示例：打开编辑器时默认载入。按国内技术岗常见写法组织：
# 经历拆成「个人职责 / 技术亮点」两块，亮点句首是加粗短标题，最后附自我评价。
# 默认 token 下约一页 A4。人物、公司与项目均为虚构。
full_skills = {"id": "m-skills", "type": "skills", "visible": True, "data": {"categories": [], "notes": [
    "熟悉 Java 集合与并发编程，理解 AQS、线程池参数的含义与常见的线程安全问题",
    "熟悉 Spring Boot、MyBatis，理解自动配置原理与 Spring 事务传播机制",
    "熟悉 MySQL 索引结构与事务隔离级别，能通过执行计划定位慢 SQL 并给出索引方案",
    "熟悉 Redis 常用数据结构与持久化机制，了解缓存穿透、击穿、雪崩的处理办法；了解 RabbitMQ 与 Docker"]}}
full_intern = {"id": "exp-1", "org": "示例云计算公司", "title": "Java 后端实习生", "start": "2026-07", "end": "至今",
    "summary": "参与统一认证中心与 API 网关建设，服务 20 余个内部系统",
    "techStack": ["Spring Cloud Gateway", "OAuth 2.0", "Redis", "Nacos"],
    "bullets": ["负责三个存量系统接入统一认证，基于 OAuth 2.0 授权码模式完成单点登录改造",
                "在网关层实现令牌校验过滤器，统一处理令牌过期、刷新与权限不足的返回",
                "接入提速：沉淀接入模板与排障手册，新系统接入时间从约 3 天缩短到半天",
                "性能优化：令牌校验结果加入本地缓存与 Redis 两级缓存，网关鉴权耗时从 18ms 降到 4ms"]}
full_proj1 = {"id": "proj-1", "name": "校园二手交易平台", "role": "后端负责人", "start": "2025-09", "end": "2026-01",
    "summary": "面向本校学生的二手交易平台，含发布、搜索、下单、站内消息，三人小组开发，注册用户 2000+",
    "techStack": ["Spring Boot", "MySQL", "Redis", "RabbitMQ", "Elasticsearch"],
    "bullets": ["个人职责：",
                "设计商品、订单、消息等核心表结构，负责下单、支付回调与订单状态流转接口",
                "技术亮点：",
                "防止超卖：库存扣减使用数据库乐观锁加重试，压测 500 并发下单无超卖",
                "订单超时关闭：利用 RabbitMQ 死信队列实现 30 分钟未支付自动关单，替代定时轮询全表",
                "热点缓存：首页热门商品与分类树放入 Redis，接口平均响应时间从 120ms 降到 35ms"]}
full_proj2 = {"id": "proj-2", "name": "轻量级 RPC 框架", "role": "独立开发", "start": "2025-04", "end": "2025-07",
    "summary": "学习型项目，从零实现注册发现、远程调用与负载均衡",
    "techStack": ["Java", "Netty", "ZooKeeper"], "url": "https://github.com/example/mini-rpc",
    "bullets": ["协议设计：基于 Netty 实现自定义协议的编解码，用长度字段解决粘包拆包",
                "注册发现：ZooKeeper 临时节点做服务注册，支持随机与轮询负载均衡",
                "可扩展：通过 SPI 机制支持 JSON 与 Hessian 序列化切换，单机调用 QPS 约 1.2 万"]}
full_edu = {"id": "m-edu", "type": "education", "visible": True, "data": {"items": [
    {"id": "edu-1", "school": "示例理工大学", "degree": "本科", "major": "网络工程",
     "start": "2024-09", "end": "2028-06",
     "highlights": ["GPA 3.7 / 4.0，专业排名前 10%；主修数据结构、操作系统、计算机网络、数据库原理"]}]}}
full_award = {"id": "m-award", "type": "award", "visible": True, "data": {"items": [
    {"id": "aw-1", "name": "蓝桥杯 Java 软件开发 省级一等奖", "date": "2026-04"},
    {"id": "aw-2", "name": "全国大学生数学建模竞赛 省级二等奖", "date": "2025-11"}]}}
full_summary = {"id": "m-summary", "type": "summary", "visible": True, "data": {"text":
    "对后端性能问题有持续兴趣，实习中独立定位过两次线上慢查询，习惯把排查过程整理成文档分享给组内。坚持写技术博客，累计 30 余篇。"}}

fixtures = {
    # 完整示例：编辑器默认载入
    "full": doc("林知夏-Java后端实习（示例，请替换）",
                [basic, intent, full_edu, full_skills, internship([full_intern]), projects([full_proj1, full_proj2]), full_award, full_summary],
                template="classic"),
    # 短样本：默认 token 下应轻松落入一页 A4
    "short": doc("林知夏-Java后端实习（示例，请替换）",
                 [basic, intent, edu, skills_short, internship([intern1]), projects([proj1]), award]),
    # 中等样本：默认 token 略超一页（目标约 1.05～1.15 页），用于测「收紧后装下」
    "medium": doc("林知夏-Java后端实习（中等样本）",
                  [basic, intent, edu, skills_long, internship([intern1, intern2]), projects([proj1, proj2]), award]),
    # 长样本：默认 token 明显超一页（目标约 1.4～1.8 页），用于测溢出报告与长一页
    "long": doc("林知夏-Java后端实习（长样本）",
                [basic, intent, edu, skills_mixed, internship([intern1, intern2]),
                 projects([proj1, proj2, proj3, proj4]), research, award_long]),
}
# 按岗位的示例（见 role_samples.py）
for key, title, template, modules in ROLE_SAMPLES:
    fixtures[key] = doc(title, modules, template=template)

out = ROOT / "fixtures"
out.mkdir(exist_ok=True)
for name, d in fixtures.items():
    (out / f"{name}.ruye.json").write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", name)
