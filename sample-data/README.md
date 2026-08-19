# Sample data

Only public or synthetic documents may be committed here. Do not add confidential company documents, personal data, credentials, or copyrighted material that cannot be redistributed.

## Fictional e-commerce knowledge base

The `xingqiao-commerce` directory contains a fully synthetic Chinese knowledge
base for the fictional company “星桥优选电子商务有限公司”. It is designed for
Dify RAG demonstrations and contains no real customer, employee, credential,
or company data.

- `01-product-manual.md` — products, specifications, pricing, warranty, and delivery
- `02-after-sales-sop.md` — returns, exchanges, refunds, ticket priorities, and escalation
- `03-expense-reimbursement-policy.md` — internal expense rules and approval thresholds
- `04-faq.md` — customer and employee frequently asked questions

Upload all four files into the same Dify knowledge base so questions can be
answered across documents.

### Suggested RAG acceptance questions

1. 新疆订单买 199 元的恒温杯需要多少运费？
2. 榨汁杯已经使用过，但没有质量问题，可以七天无理由退货吗？
3. 收到错发商品 60 小时后才发现，客服是否应该直接拒绝？
4. 退货被仓库签收后，退款通常需要经过哪些时间阶段？
5. 2,500 元的运营费用需要经过谁审批？
6. 去上海出差两晚，住宿标准上限是多少？
7. 员工能否先用个人微信赔偿客户，再提交公司报销？
8. XQ-CUP-01 可以放进洗碗机或用来加热牛奶吗？

Questions 3, 4, and 7 are especially useful because a good answer must apply
policy details rather than match only a product keyword.
