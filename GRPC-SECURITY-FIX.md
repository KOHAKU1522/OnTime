# @grpc/grpc-js 警告2件の対応（2026-10-27）

## 調査結果

- 対象として提示された警告: [#16](https://github.com/KOHAKU1522/OnTime/security/dependabot/16)、[#15](https://github.com/KOHAKU1522/OnTime/security/dependabot/15)。ページ本文はWeb取得できず、Brave操作もツール側の利用承認で拒否された。#15のブラウザウィンドウタイトルは下記Lowと一致した。番号と本文の完全な照合、GitHub上の解消確認は未実施。
- npm公式監査で現在のロックファイルに対する以下の2件を再現した。
  - High: [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) / CVE-2026-101916。特定構成のgetAuthContextによる未承認証明書の扱い。
  - Low: [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) / CVE-2026-101915。サーバーハンドラのエラー内容の漏えい。
  - 両方とも `<1.13.6` および `>=1.14.0 <1.14.5` が影響範囲。修正版は1.13.6、1.14.5。
- 元の依存経路: `firebase@13.0.0 → @firebase/firestore@4.18.0 → @grpc/grpc-js@1.9.16`。Firestoreの指定は `~1.9.0`。Admin / google-gax側は既に1.14.6で修正済みだった。
- npmレジストリで最新正式版 `firebase@13.1.0 → @firebase/firestore@4.19.0` を確認したが、こちらも `~1.9.0`。Firebase関連の正式版への更新だけでは解決できない。参考: [Firebase upstream issue #10400](https://github.com/firebase/firebase-js-sdk/issues/10400)。
- 既存のNode 24指定、Netlify Functionsの事前バンドル、タスク購読のエラー・キャッシュ判定、認証待ちの表示修正を確認し、維持した。この取得フォルダには.gitがなく、過去コミットとの履歴比較はできない。

## 変更

`package.json` にFirestore限定の指定を追加した。

```json
"overrides": {
  "@firebase/firestore": {
    "@grpc/grpc-js": "1.14.6"
  }
}
```

Firebaseをダウングレードせず、アプリコード、Firebase設定、ルール、Functions側ロックファイルは変更していない。ルートのロックファイルではgRPCを1.14.6に更新し、既存のAdmin側コピーと統合した。新gRPCが必要とする専用のproto-loader 0.8.1を追加し、Firestore自身のproto-loader 0.7系は維持した。その他の既存パッケージのバージョン更新はない。

これはFirestoreの宣言範囲を超える一時的な互換性対応であり、上流が正式対応した時点で解除を再検討する。ブラウザではWebChannelを使うが、Node側のFirestore gRPCとAdmin SDKもエミュレータで実通信を検証した。

## 検証結果

- Node.js 24.22.1 / npm 11.6.2。
- `npm test`: 18件成功。Netlifyのrequire(esm)無効環境での起動・未認証拒否も含む。
- `npm --prefix functions test`: 3件成功。
- `npm run lint`: 成功。
- `npm run build:netlify`: 成功。既存の500 kB超チャンク警告は残る。
- クリーンな隔離フォルダで最終package.json / package-lock.jsonによる `npm ci --ignore-scripts --no-audit --no-fund` と依存ツリーを確認。
- `npm audit`: 対象のgRPC警告2件とFirebaseへの波及警告は消失。対象外の `zod@4.3.6` のHigh [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) 1件は残る。今回これに対する更新は行っていない。
- `tests/integration/firebase-grpc.test.mjs`: Auth / Firestoreエミュレータで成功。アカウント作成、サインアウト・再ログイン、タスク追加・サーバー読み取り・編集・購読更新・トランザクション・削除、未認証と別ユーザーのアクセス拒否、Admin SDKのgRPC読み書きを検証。
- エミュレータテストはdemoプロジェクトと127.0.0.1の固定ポートを検査し、設定が違えば開始前に失敗する。実ルールを使用し、エクスポート・本番接続は行わない。

Java 21以降とNode 24を用意し、ルートで次のように再実行できる（ポート8080 / 9099を使用）。

```sh
npm ci
npm test
npm run lint
npm --prefix functions test
npx --yes firebase-tools@15.34.1 emulators:exec --config firebase.emulators.json --project demo-ontime-grpc --only auth,firestore "node --test tests/integration/firebase-grpc.test.mjs"
```

ビルドは必要なVITE変数を設定して `npm run build:netlify`。今回生成したdistは検証用ダミーFirebase設定のため、そのまま配信しない。検証用npm、Java、Firebase CLIはnode_modules/.ontime-validation内に置き、依存マニフェストには追加していない。

ブラウザ画面からのGoogle OAuthログイン、実Firebase環境での操作は未検証。SDKレベルのエミュレータ検証と区別する。本番データの操作、push、デプロイ、Dependabot警告のdismissは実施していない。GitHub上の警告の自動解消は、レビュー後に既定ブランチへ反映してから確認する必要がある。
