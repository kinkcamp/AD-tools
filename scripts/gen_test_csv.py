# -*- coding: utf-8 -*-
"""生成批量创建用户测试 CSV"""
from pypinyin import lazy_pinyin

DATA = """张鑫,运营部
刘宇,产品部
梁飞,人力资源部
杨勇,财务部
吴宇,行政部
梁梓,技术部
彭轩,客服部
朱娟,销售部
丁涵,行政部
沈艳,行政部
李飞,销售部
马轩,技术部
张博,客服部
丁博,财务部
李刚,客服部
赵敏,客服部
胡文,产品部
彭轩,人力资源部
袁秀英,人力资源部
王瑶,市场部
萧瑶,市场部
薛怡,客服部
杨涛,产品部
彭欣,行政部
傅飞,技术部
谢华,行政部
马轩,行政部
魏飞,人力资源部
陈瑶,行政部
宋然,客服部
程平,产品部
贾文,行政部
许飞,研发部
郑辰,人力资源部
李静,产品部
魏宇,行政部
彭轩,人力资源部
朱洋,市场部
朱慧,技术部
丁文,财务部
何宇,客服部
丁晴,技术部
周飞,行政部
阎芳,人力资源部
郭丽,运营部
郭萱,财务部
蒋平,财务部
郭文,研发部
马飞,财务部
蒋刚,市场部
陈轩,行政部
徐欣,销售部
高浩,人力资源部
高平,行政部
陈杰,研发部
吕飞,产品部
薛辰,产品部
李秀兰,客服部
唐曦,财务部
黄怡,行政部
吴宇,运营部
韩慧,市场部
杨敏,技术部
邓怡,人力资源部
刘超,人力资源部
林建,运营部
蒋洋,运营部
朱明,客服部
沈霞,技术部
叶轩,客服部
胡杰,财务部
吕辰,市场部
许丽,销售部
傅涛,市场部
蒋欣,技术部
张然,行政部
冯杰,技术部
王涛,行政部
蒋瑶,运营部
李磊,行政部
李慧,技术部
曾明,客服部
许斌,市场部
彭平,技术部
谢怡,行政部
卢洋,运营部
高洋,市场部
罗秀兰,销售部
王娜,技术部
赵博,产品部
阎慧,财务部
吕辰,运营部
袁玉兰,研发部
宋平,运营部
魏静,行政部
梁涛,市场部
刘欣,人力资源部
贾鑫,人力资源部
韩萱,销售部
薛平,技术部"""

OU = "CN=Users,DC=sirrr,DC=cn"
DOMAIN = "sirrr.cn"


def to_username(name: str) -> str:
    py = "".join(lazy_pinyin(name))
    # ü 等非 ASCII 字符转换（如 吕 -> lü）
    return py.replace("ü", "v").lower()


def csv_field(value: str) -> str:
    # DN 含逗号必须加引号，否则 csv 解析会断裂
    if "," in value or '"' in value:
        return '"' + value.replace('"', '""') + '"'
    return value


used = {}
rows = []
for line in DATA.strip().splitlines():
    name, dept = line.split(",")
    base = to_username(name)
    n = used.get(base, 0) + 1
    used[base] = n
    username = base if n == 1 else f"{base}{n}"
    rows.append((username, name, dept))

header = "sAMAccountName,displayName,ou,mail,department,title,telephoneNumber,description"
lines = [header]
for username, name, dept in rows:
    mail = f"{username}@{DOMAIN}"
    lines.append(",".join([
        username, name, csv_field(OU), mail, dept, "员工", "", "测试账户-批量导入",
    ]))


with open("batch_users_test.csv", "w", encoding="utf-8-sig") as f:
    for line in lines:
        f.write(line + "\n")

print(f"生成 {len(rows)} 条记录")
dupes = {k: v for k, v in used.items() if v > 1}
print(f"重名处理: {dupes}")
for username, name, dept in rows[:5]:
    print(f"  {username} <- {name} ({dept})")
