# 香港行

行程、記帳（誰付、品項、時間、平均／依比例／自填拆分）、筆記。共用密碼進入，Firestore 即時同步。

## 設定
1. Firebase 主控台新增專案 → 建立 Firestore（正式模式）。
2. 專案設定 → 新增 Web 應用程式 → 把設定貼到 `src/environments/environment.ts`。
3. Firestore → 規則：貼上 `firestore.rules` 的內容並發布。
4. `npm start` 本機測試；`npm run build` 後輸出在 `dist/hk-trip/browser`，可部署到 Vercel。

## 運作方式
密碼經 SHA-256 雜湊後成為 `trips/{雜湊}` 的文件 ID；規則不允許列出 trips，所以沒有密碼就找不到資料。
首次輸入新密碼會建立旅行並放入初始行程。
