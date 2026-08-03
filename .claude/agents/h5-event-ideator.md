---
name: h5-event-ideator
description: 已被拆解為三個獨立 Skill，保留此檔案僅作導覽用途，不建議再以 subagent 形式呼叫。
tools: Read, Grep, Glob
model: inherit
---

# 本檔案已停用

這個 subagent 原本承載的知識與流程，已經拆解重組成「H5 活動規劃工具」的四層架構，分散到以下位置，內容更完整、也更省 token（依查詢篩選讀取，不會整包塞進對話）：

- **知識庫（原本這個檔案的案例卡/KPI/機制歸納內容）**：`.claude/knowledge/h5-activities/`（`README.md` 說明結構，`index.md` 是檢索入口，`cases/*.md` 是逐引擎案例卡，`mechanism-insights.md` 是跨案例歸納，`kpi-and-qa-reference.md` 是 KPI/合規清單）
- **學習新工單、檢索既有洞察**：Skill `learn-insights`
- **規劃新活動、產出企劃書**：Skill `plan-h5-activity`
- **把企劃書做成互動 Demo**：Skill `generate-h5-demo`

以後不需要再呼叫 `h5-event-ideator` 這個 subagent，改用 `plan-h5-activity` skill 即可涵蓋原本的功能，並會視需要自動呼叫 `learn-insights` 補充洞察。
