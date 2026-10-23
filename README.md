# Hatchan-bot

Discord用の「冷笑警察bot」です。監視対象チャンネルで特定の文字列を含むメッセージを検知すると、メンション無しで返信します。

## 機能

- `/start`, `/stop` で、コマンドを実行したチャンネルの監視を開始・停止できます
- デフォルトで「うお」「おお」「どわ」のいずれかを含むメッセージに反応します
- `/trigger add` で反応する文字列と、その文字列専用の返信内容を後から追加・更新できます（返信内容を省略した場合は標準の冷笑警察メッセージが使われます）
- `/trigger remove` / `/trigger list` で登録済みの文字列の削除・一覧表示ができます
- 設定（監視中チャンネル・トリガー一覧）は `data/store.json` に保存され、再起動しても保持されます
- `/delay start`, `/delay stop`, `/delay status` で、名鉄名古屋本線・JR東海道本線（豊橋～米原）の遅延・運転見合わせ等を定期チェックし、状態が変化したときにチャンネルへ通知します（詳細は後述）

デフォルトの返信内容:

```
🚨冷笑を検知しました🚨
👮冷笑警察👮です。
時代は__**～熱笑～**__。
笑いに温度を。笑いに魂を。
もっと熱く笑いましょう。
ガハハwWwwWwwww
ガハハハハハハハハwwwwww
```

## セットアップ

### 1. Discord Developer Portal でアプリケーションを作成

1. https://discord.com/developers/applications で新規アプリケーションを作成
2. 「Bot」タブでBotを作成し、**Token** を控える
3. 「Bot」タブの **Privileged Gateway Intents** で **MESSAGE CONTENT INTENT** を有効化する（メッセージ内容の取得に必須）
4. 「OAuth2 > URL Generator」で以下を選択し、生成されたURLからサーバーに招待する
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `View Channels`, `Send Messages`, `Read Message History`

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、値を埋めます。

```
cp .env.example .env
```

- `DISCORD_TOKEN`: Botのトークン
- `DISCORD_CLIENT_ID`: アプリケーションID（General Information ページに記載）
- `DISCORD_GUILD_ID`: （任意）開発用サーバーのID。指定するとスラッシュコマンドが即時反映されます。未指定の場合はグローバル登録となり反映まで時間がかかることがあります。

### 3. 依存関係のインストール

```
npm install
```

### 4. スラッシュコマンドの登録

```
npm run deploy-commands
```

### 5. Bot起動

```
npm start
```

## サーバー側の更新手順（今後コードが更新されたとき）

`main` ブランチに新しい変更がマージされた後、稼働中のサーバーに反映する手順です。

1. Bot稼働中のサーバーにログインし、リポジトリのディレクトリに移動する
2. 最新の `main` を取得する
   ```
   git fetch origin main
   git checkout main
   git pull origin main
   ```
3. 依存関係に変更がある場合に備えて再インストールする
   ```
   npm install
   ```
4. スラッシュコマンドの内容（`src/commands.js`）が変更された場合のみ、再登録する
   ```
   npm run deploy-commands
   ```
   コマンドの追加・削除・オプション変更がない更新（バグ修正など）ではこの手順は不要です。
5. Botプロセスを再起動する（コード変更を反映するには再起動が必須）
   - `pm2` で動かしている場合: `pm2 restart <プロセス名>`
   - `systemd` サービスにしている場合: `sudo systemctl restart <サービス名>`
   - `screen`/`tmux` 等でフォアグラウンド実行している場合: 一度 `Ctrl+C` で停止し、`npm start` で起動し直す
   - Dockerで動かしている場合: イメージを再ビルドしてコンテナを再作成する（`docker compose up -d --build` など）
6. 起動ログに `[bot] ログインしました: ...` と `[delay] 遅延監視を開始しました` が出ていることを確認する
7. 遅延情報のスクレイピング対象ページの構造が変わっていないか気になる場合は `npm run check-delay` で事前確認する（詳細は後述の遅延情報通知機能の節）

## 使い方

1. 監視したいチャンネルで `/start` を実行（監視開始）
2. 「うお」「おお」「どわ」のいずれかを含むメッセージが投稿されると、bot が該当メッセージにメンション無しで返信します
3. 監視をやめたい場合は同じチャンネルで `/stop` を実行

### トリガーの追加・管理

```
/trigger add word:わお reply:任意の返信メッセージ
/trigger add word:へへ            # replyを省略すると標準メッセージが使われます
/trigger remove word:わお
/trigger list
```

`/start`, `/stop`, `/trigger` はいずれもサーバー管理権限（Manage Server）を持つメンバーのみ実行できます。

## 遅延情報通知機能（名鉄名古屋本線・JR東海道本線）

名鉄名古屋本線とJR東海道本線（豊橋～米原）の運行情報を定期的にチェックし、「平常運転 → 異常発生」「異常発生 → 平常運転」の変化があったタイミングでチャンネルに通知します。

- `/delay start` — 実行したチャンネルへの通知を開始
- `/delay stop` — 通知を停止
- `/delay status` — 定期チェックを待たずに、今の運行状況をその場で確認（通知は送らず結果を表示するだけ）

チェック間隔は既定で3分です。変更したい場合は `.env` に `DELAY_CHECK_INTERVAL_MS`（ミリ秒）を設定してください。

監視対象の路線は `src/delaySources.js` の `LINE_SOURCES` 配列に定義されています。他の路線を追加したい場合はここに `{ key, label, url }` を追記してください。

### ⚠️ 重要: 運用前に必ず動作確認してください

名鉄・JR東海ともに、遅延情報を取得できる公式のオープンAPIは提供されていません。そのため、このボットでは両路線をまとめて確認できる **Yahoo!路線情報** の路線別ページ（`transit.yahoo.co.jp/diainfo/...`）を取得し、ページ内の`meta description`（見つからない場合は本文テキスト）から「平常運転」「運転見合わせ」などのキーワードを抜き出す、という方式で実装しています。

このURL・解析方法は、Claude Code を実行していた環境のネットワーク制限（GitHub等の許可されたホスト以外へ出られない設定）により、実際のページを直接取得して構造を検証することができず、Web検索で得られたスニペット情報から推測して実装したものです。そのため、**デプロイ前に必ず以下を実行し、意図したとおりに解析できているか確認してください**:

```
npm run check-delay
```

実行すると、両路線について取得・解析結果がJSONで表示されます。`ok: true` で `isNormal` / `statusLabel` / `detail` が実際の運行状況と一致していればOKです。もし `ok: false` になったり、内容が明らかにおかしい場合は、`raw` フィールド（実際に抜き出された文字列）を見ながら `src/delayScraper.js` の抽出ロジック（`extractFromMeta` / `extractFromBodyText`）を調整してください。

その他の留意点:

- Yahoo!路線情報・各社公式サイトとも、個人・自動取得を想定したAPIではないため、利用規約上は継続的な自動アクセスが許可されていない可能性があります。個人的な用途として、チェック間隔を短くしすぎない（既定の3分以上を推奨）など、サイトに負荷をかけない運用を心がけてください。
- ページのデザイン変更が入ると解析が失敗するようになります。`/delay status` を時々実行して正しく取得できているか確認するか、ログ（`[delay] ... を解析できませんでした`という警告）に注意してください。
- より信頼性を重視する場合は、名鉄公式の運行情報（top.meitetsu.co.jp/em/ 付近）やJR東海公式の在来線運行状況（traininfo.jr-central.co.jp/zairaisen/index.html）を直接スクレイピングする方式への切り替えも可能です。その場合も同様に、実際のページ構造を目視・取得確認した上で `src/delayScraper.js` を調整する必要があります。
